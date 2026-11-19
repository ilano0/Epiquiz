CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE quizzes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quizzes_owner_id_idx ON quizzes (owner_id);

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quizzes_set_updated_at
    BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    type text NOT NULL CHECK (type IN ('single', 'multiple', 'true_false', 'text')),
    text text NOT NULL,
    media_key text,
    duration_s integer NOT NULL DEFAULT 20 CHECK (duration_s BETWEEN 5 AND 300),
    points integer NOT NULL DEFAULT 1000 CHECK (points >= 0),
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT questions_quiz_position_unique UNIQUE (quiz_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    text text NOT NULL,
    media_key text,
    is_correct boolean NOT NULL DEFAULT false,
    CONSTRAINT options_question_position_unique UNIQUE (question_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes (id) ON DELETE RESTRICT,
    host_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    pin char(6) NOT NULL CHECK (pin ~ '^[0-9]{6}$'),
    mode text NOT NULL DEFAULT 'classic' CHECK (mode IN ('classic', 'team', 'homework')),
    status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'running', 'finished')),
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz
);

CREATE UNIQUE INDEX games_active_pin_unique ON games (pin) WHERE status <> 'finished';
CREATE INDEX games_host_finished_idx ON games (host_id, finished_at DESC);
CREATE INDEX games_quiz_id_idx ON games (quiz_id);

CREATE TABLE game_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    question_snapshot jsonb NOT NULL,
    CONSTRAINT game_questions_game_position_unique UNIQUE (game_id, position)
);

CREATE TABLE teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    name text NOT NULL,
    CONSTRAINT teams_game_name_unique UNIQUE (game_id, name)
);

CREATE TABLE players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
    nickname text NOT NULL,
    final_score integer,
    final_rank integer,
    joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX players_game_nickname_unique ON players (game_id, lower(nickname));
CREATE INDEX players_team_id_idx ON players (team_id);

CREATE TABLE answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_question_id uuid NOT NULL REFERENCES game_questions (id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    choice jsonb NOT NULL,
    is_correct boolean NOT NULL,
    response_ms integer NOT NULL CHECK (response_ms >= 0),
    points integer NOT NULL DEFAULT 0,
    streak integer NOT NULL DEFAULT 0,
    CONSTRAINT answers_question_player_unique UNIQUE (game_question_id, player_id)
);

CREATE INDEX answers_player_id_idx ON answers (player_id);
