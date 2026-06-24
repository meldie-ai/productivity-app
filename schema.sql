-- TickTick Clone – PostgreSQL Schema
-- Run: psql -U <user> -d <db> -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  dark_mode     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lists ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lists (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  color      VARCHAR(7)  DEFAULT '#4772FA',
  icon       VARCHAR(10) DEFAULT '📋',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id         INTEGER REFERENCES lists(id) ON DELETE SET NULL,
  title           VARCHAR(500) NOT NULL,
  notes           TEXT,
  due_date        DATE,
  priority        VARCHAR(10) DEFAULT 'none'
                    CHECK (priority IN ('low','medium','high','none')),
  tags            TEXT[]  DEFAULT '{}',
  completed       BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  pomodoro_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Subtasks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtasks (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      VARCHAR(500) NOT NULL,
  completed  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Habits ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  emoji      VARCHAR(10) DEFAULT '✅',
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Habit Logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id         SERIAL PRIMARY KEY,
  habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (habit_id, log_date)
);

-- ─── Pomodoro Sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id          INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  duration_minutes INTEGER DEFAULT 25,
  session_type     VARCHAR(20) DEFAULT 'focus'
                     CHECK (session_type IN ('focus','short_break','long_break')),
  completed        BOOLEAN DEFAULT FALSE,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_user    ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list    ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due     ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_habits_user   ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_hlogs_habit   ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_hlogs_date    ON habit_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_task ON pomodoro_sessions(task_id);
