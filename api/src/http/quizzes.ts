import {
  Router,
  type ErrorRequestHandler,
  type Request,
} from "express";
import { z } from "zod";
import {
  InvalidOrderError,
  MAX_QUESTIONS_PER_QUIZ,
  NotFoundError,
  QUESTION_TYPES,
  QuestionLimitError,
  QuizInUseError,
  type QuizService,
} from "../services/quizzes.js";
import type { AuthService } from "../services/auth.js";
import { requireAuth } from "./middleware/auth.js";

class ValidationError extends Error {
  readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>) {
    super("invalid_input");
    this.fields = fields;
  }
}

const optionSchema = z.object({
  text: z.string().trim().min(1).max(200),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    text: z.string().trim().min(1).max(500),
    durationS: z.number().int().min(5).max(300).default(20),
    points: z.number().int().min(0).max(10000).default(1000),
    options: z.array(optionSchema).max(10),
  })
  .superRefine((question, ctx) => {
    const correct = question.options.filter((option) => option.isCorrect).length;
    const total = question.options.length;
    const fail = (message: string) => ctx.addIssue({ code: "custom", message, path: ["options"] });

    switch (question.type) {
      case "single":
        if (total < 2 || total > 6) fail("Une question à choix unique a de 2 à 6 réponses.");
        else if (correct !== 1) fail("Une question à choix unique a exactement une bonne réponse.");
        break;
      case "multiple":
        if (total < 2 || total > 6) fail("Une question à choix multiples a de 2 à 6 réponses.");
        else if (correct < 1) fail("Une question à choix multiples a au moins une bonne réponse.");
        break;
      case "true_false":
        if (total !== 2) fail("Une question vrai ou faux a exactement 2 réponses.");
        else if (correct !== 1) fail("Une question vrai ou faux a exactement une bonne réponse.");
        break;
      case "text":
        if (total < 1) fail("Une question à réponse libre a au moins une réponse acceptée.");
        else if (correct !== total) fail("Toutes les réponses acceptées d'une réponse libre sont correctes.");
        break;
    }
  });

const createQuizSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
});

const updateQuizSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .refine((patch) => patch.title !== undefined || patch.description !== undefined, {
    message: "Au moins un champ à modifier.",
    path: ["title"],
  });

const reorderSchema = z.object({
  questionIds: z.array(z.uuid()).max(MAX_QUESTIONS_PER_QUIZ),
});

function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  }
  return parsed.data;
}

function parseId(value: unknown): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new NotFoundError();
  }
  return parsed.data;
}

function owner(req: Request): string {
  return req.userId!;
}

interface QuizzesRouterDeps {
  auth: AuthService;
  quizzes: QuizService;
}

export function createQuizzesRouter({ auth, quizzes }: QuizzesRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(auth));

  router.get("/", async (req, res) => {
    res.json({ quizzes: await quizzes.list(owner(req)) });
  });

  router.post("/", async (req, res) => {
    const quiz = await quizzes.create(owner(req), parseBody(createQuizSchema, req.body));
    res.status(201).json({ quiz });
  });

  router.get("/:id", async (req, res) => {
    res.json({ quiz: await quizzes.get(owner(req), parseId(req.params.id)) });
  });

  router.patch("/:id", async (req, res) => {
    const quiz = await quizzes.update(owner(req), parseId(req.params.id), parseBody(updateQuizSchema, req.body));
    res.json({ quiz });
  });

  router.delete("/:id", async (req, res) => {
    await quizzes.remove(owner(req), parseId(req.params.id));
    res.status(204).end();
  });

  router.post("/:id/questions", async (req, res) => {
    const question = await quizzes.addQuestion(
      owner(req),
      parseId(req.params.id),
      parseBody(questionSchema, req.body),
    );
    res.status(201).json({ question });
  });

  router.put("/:id/questions/order", async (req, res) => {
    const { questionIds } = parseBody(reorderSchema, req.body);
    const quiz = await quizzes.reorderQuestions(owner(req), parseId(req.params.id), questionIds);
    res.json({ quiz });
  });

  router.put("/:id/questions/:questionId", async (req, res) => {
    const question = await quizzes.updateQuestion(
      owner(req),
      parseId(req.params.id),
      parseId(req.params.questionId),
      parseBody(questionSchema, req.body),
    );
    res.json({ question });
  });

  router.delete("/:id/questions/:questionId", async (req, res) => {
    await quizzes.removeQuestion(owner(req), parseId(req.params.id), parseId(req.params.questionId));
    res.status(204).end();
  });

  const onError: ErrorRequestHandler = (err, _req, res, next) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: "invalid_input", fields: err.fields });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: "not_found" });
    } else if (err instanceof QuizInUseError) {
      res.status(409).json({ error: "quiz_has_games" });
    } else if (err instanceof QuestionLimitError) {
      res.status(409).json({ error: "question_limit_reached", max: MAX_QUESTIONS_PER_QUIZ });
    } else if (err instanceof InvalidOrderError) {
      res.status(400).json({ error: "invalid_order" });
    } else {
      next(err);
    }
  };
  router.use(onError);

  return router;
}
