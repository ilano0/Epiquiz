import {
  InvalidOrderError,
  MAX_QUESTIONS_PER_QUIZ,
  QUESTION_TYPES,
  QuestionLimitError,
  QuizInUseError,
  type Question,
  type QuestionInput,
  type Quiz,
  type QuizRepository,
  type QuizSummary,
} from "../repositories/quizzes.js";

export class NotFoundError extends Error {
  constructor() {
    super("not_found");
  }
}

export {
  InvalidOrderError,
  MAX_QUESTIONS_PER_QUIZ,
  QUESTION_TYPES,
  QuestionLimitError,
  QuizInUseError,
  type Question,
  type QuestionInput,
  type Quiz,
  type QuizSummary,
};

function orNotFound<T>(value: T | null): T {
  if (value === null) {
    throw new NotFoundError();
  }
  return value;
}

export function createQuizService(quizzes: QuizRepository) {
  async function getQuiz(ownerId: string, quizId: string): Promise<Quiz> {
    return orNotFound(await quizzes.get(quizId, ownerId));
  }

  return {
    list(ownerId: string): Promise<QuizSummary[]> {
      return quizzes.list(ownerId);
    },

    get: getQuiz,

    create(ownerId: string, input: { title: string; description: string }): Promise<Quiz> {
      return quizzes.create(ownerId, input);
    },

    async update(
      ownerId: string,
      quizId: string,
      patch: { title?: string | undefined; description?: string | undefined },
    ): Promise<Quiz> {
      if (!(await quizzes.update(quizId, ownerId, patch))) {
        throw new NotFoundError();
      }
      return getQuiz(ownerId, quizId);
    },

    async remove(ownerId: string, quizId: string): Promise<void> {
      if (!(await quizzes.remove(quizId, ownerId))) {
        throw new NotFoundError();
      }
    },

    async addQuestion(ownerId: string, quizId: string, input: QuestionInput): Promise<Question> {
      return orNotFound(await quizzes.addQuestion(quizId, ownerId, input));
    },

    async updateQuestion(
      ownerId: string,
      quizId: string,
      questionId: string,
      input: QuestionInput,
    ): Promise<Question> {
      return orNotFound(await quizzes.updateQuestion(quizId, ownerId, questionId, input));
    },

    async removeQuestion(ownerId: string, quizId: string, questionId: string): Promise<void> {
      if (!(await quizzes.removeQuestion(quizId, ownerId, questionId))) {
        throw new NotFoundError();
      }
    },

    async reorderQuestions(ownerId: string, quizId: string, questionIds: string[]): Promise<Quiz> {
      if (!(await quizzes.reorderQuestions(quizId, ownerId, questionIds))) {
        throw new NotFoundError();
      }
      return getQuiz(ownerId, quizId);
    },
  };
}

export type QuizService = ReturnType<typeof createQuizService>;
