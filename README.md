# TickFlow – Full-Stack Productivity App

A productivity app with Task Manager, Habit Tracker, and Pomodoro Timer.

**Stack:** React 18 + Tailwind CSS (Vite) · Node/Express · PostgreSQL · JWT auth

---

## Quick Start

### 1. Database

```bash
createdb tickflow
psql -U postgres -d tickflow -f schema.sql
```

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET
npm install
npm run dev        # runs on http://localhost:4000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev        # runs on http://localhost:5173
```

Open **http://localhost:5173**, register, and you're in.

---

## Project Structure

```
tickflow/
├── schema.sql              PostgreSQL schema
├── server/
│   ├── index.js            Express app (all routes)
│   ├── package.json
│   └── .env.example
└── client/
    ├── src/
    │   ├── App.jsx                  Root shell, dark mode, routing
    │   ├── api.js                   Typed fetch wrappers for every route
    │   ├── contexts/AuthContext.jsx  JWT auth state
    │   └── components/
    │       ├── Auth.jsx             Login / Register
    │       ├── Sidebar.jsx          Nav + list management
    │       ├── TaskManager.jsx      Inbox / Today / Tomorrow / List views
    │       ├── TaskDetail.jsx       Right-slide panel (notes, subtasks, meta)
    │       ├── HabitTracker.jsx     Monthly grid + streaks
    │       └── PomodoroTimer.jsx    25/5/15 timer + session tracking
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register + seed default habits/list |
| POST | /api/auth/login | Login → JWT |
| GET  | /api/auth/me | Current user |
| GET/POST/PUT/DELETE | /api/lists | CRUD lists |
| GET/POST/PUT/DELETE | /api/tasks | CRUD tasks (`?filter=today\|tomorrow`, `?list_id=`) |
| POST/PUT/DELETE | /api/tasks/:id/subtasks | Subtask management |
| GET/POST/PUT/DELETE | /api/habits | CRUD habits |
| GET  | /api/habit-logs | Logs for month (`?year=&month=`) |
| POST | /api/habit-logs/toggle | Toggle a day's completion |
| GET  | /api/habits/:id/streak | Current + longest streak |
| POST | /api/pomodoro-sessions | Create session |
| PATCH | /api/pomodoro-sessions/:id/complete | Complete session |

---

## Features

- **Task Manager** — Inbox, Today, Tomorrow smart lists. Per-task detail panel with notes, subtasks, priority, tags, and list assignment. Overdue dates highlighted in red.
- **Habit Tracker** — Monthly grid, click to toggle days. Streak counter (current + longest), completion % bar. Pre-loaded with 6 habits on registration.
- **Pomodoro Timer** — Animated ring, focus/short break/long break modes. Link a task to the session; pomodoro count increments on task automatically. Browser notifications on completion.
- **Dark Mode** — Toggle in sidebar, stored in localStorage and synced to DB.
- **Auth** — Email + password with bcrypt, 30-day JWT. Every resource is user-scoped.

---

## Environment Variables

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://postgres:pass@localhost:5432/tickflow` |
| `JWT_SECRET` | any long random string |
| `PORT` | `4000` (default) |
| `CLIENT_ORIGIN` | `http://localhost:5173` |
