require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Pool } = require('pg');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(express.json());

// JWT auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email.toLowerCase(), hash, name || null]
    );
    const user = rows[0];

    // Seed default habits for new user
    const defaultHabits = [
      { name: 'Sleep 8 hrs',   emoji: '😴' },
      { name: 'Exercise',      emoji: '🏃' },
      { name: 'Vitamins',      emoji: '💊' },
      { name: 'Study',         emoji: '📚' },
      { name: 'Screen limit',  emoji: '📵' },
      { name: 'Hydration',     emoji: '💧' },
    ];
    for (const h of defaultHabits) {
      await pool.query(
        'INSERT INTO habits (user_id, name, emoji) VALUES ($1,$2,$3)',
        [user.id, h.name, h.emoji]
      );
    }

    // Seed default list
    await pool.query(
      "INSERT INTO lists (user_id, name, color, icon) VALUES ($1,'Personal','#4772FA','👤')",
      [user.id]
    );

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email=$1', [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, dark_mode: user.dark_mode } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, name, dark_mode FROM users WHERE id=$1', [req.user.id]
  );
  res.json(rows[0]);
});

app.patch('/api/auth/me', auth, async (req, res) => {
  const { name, dark_mode } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET name=COALESCE($1,name), dark_mode=COALESCE($2,dark_mode) WHERE id=$3 RETURNING id,email,name,dark_mode',
    [name, dark_mode, req.user.id]
  );
  res.json(rows[0]);
});

// ─── Lists ────────────────────────────────────────────────────────────────────
app.get('/api/lists', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM lists WHERE user_id=$1 ORDER BY created_at ASC', [req.user.id]
  );
  res.json(rows);
});

app.post('/api/lists', auth, async (req, res) => {
  const { name, color = '#4772FA', icon = '📋' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { rows } = await pool.query(
    'INSERT INTO lists (user_id,name,color,icon) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.user.id, name, color, icon]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/lists/:id', auth, async (req, res) => {
  const { name, color, icon } = req.body;
  const { rows } = await pool.query(
    `UPDATE lists SET
       name=COALESCE($1,name), color=COALESCE($2,color), icon=COALESCE($3,icon)
     WHERE id=$4 AND user_id=$5 RETURNING *`,
    [name, color, icon, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.delete('/api/lists/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM lists WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
app.get('/api/tasks', auth, async (req, res) => {
  const { filter, list_id } = req.query;
  const uid = req.user.id;
  let query, params;

  const base = `SELECT t.*,
    (SELECT json_agg(s ORDER BY s.created_at) FROM subtasks s WHERE s.task_id=t.id) AS subtasks
  FROM tasks t WHERE t.user_id=$1`;

  if (filter === 'today') {
    query  = `${base} AND t.due_date = CURRENT_DATE ORDER BY t.completed ASC, t.created_at DESC`;
    params = [uid];
  } else if (filter === 'tomorrow') {
    query  = `${base} AND t.due_date = CURRENT_DATE + INTERVAL '1 day' ORDER BY t.completed ASC, t.created_at DESC`;
    params = [uid];
  } else if (list_id) {
    query  = `${base} AND t.list_id=$2 ORDER BY t.completed ASC, t.created_at DESC`;
    params = [uid, list_id];
  } else {
    // Inbox = no list
    query  = `${base} AND t.list_id IS NULL ORDER BY t.completed ASC, t.created_at DESC`;
    params = [uid];
  }

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.get('/api/tasks/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*,
       (SELECT json_agg(s ORDER BY s.created_at) FROM subtasks s WHERE s.task_id=t.id) AS subtasks
     FROM tasks t WHERE t.id=$1 AND t.user_id=$2`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.post('/api/tasks', auth, async (req, res) => {
  const { title, notes, due_date, priority = 'none', tags = [], list_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const { rows } = await pool.query(
    `INSERT INTO tasks (user_id,list_id,title,notes,due_date,priority,tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.id, list_id || null, title, notes || null, due_date || null, priority, tags]
  );
  res.status(201).json({ ...rows[0], subtasks: [] });
});

app.put('/api/tasks/:id', auth, async (req, res) => {
  const { title, notes, due_date, priority, tags, completed, list_id } = req.body;
  const completed_at = completed === true ? 'NOW()' : null;
  const { rows } = await pool.query(
    `UPDATE tasks SET
       title       = COALESCE($1, title),
       notes       = COALESCE($2, notes),
       due_date    = COALESCE($3::date, due_date),
       priority    = COALESCE($4, priority),
       tags        = COALESCE($5, tags),
       completed   = COALESCE($6, completed),
       completed_at= CASE WHEN $6 IS TRUE THEN NOW() WHEN $6 IS FALSE THEN NULL ELSE completed_at END,
       list_id     = COALESCE($7, list_id)
     WHERE id=$8 AND user_id=$9 RETURNING *`,
    [title, notes, due_date || null, priority, tags, completed, list_id || null, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  // Return with subtasks
  const full = await pool.query(
    `SELECT t.*,
       (SELECT json_agg(s ORDER BY s.created_at) FROM subtasks s WHERE s.task_id=t.id) AS subtasks
     FROM tasks t WHERE t.id=$1`, [rows[0].id]
  );
  res.json(full.rows[0]);
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ─── Subtasks ─────────────────────────────────────────────────────────────────
app.post('/api/tasks/:taskId/subtasks', auth, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  // Verify task belongs to user
  const check = await pool.query('SELECT id FROM tasks WHERE id=$1 AND user_id=$2', [req.params.taskId, req.user.id]);
  if (!check.rows[0]) return res.status(404).json({ error: 'Task not found' });

  const { rows } = await pool.query(
    'INSERT INTO subtasks (task_id, title) VALUES ($1,$2) RETURNING *',
    [req.params.taskId, title]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/subtasks/:id', auth, async (req, res) => {
  const { title, completed } = req.body;
  // Verify ownership via join
  const { rows } = await pool.query(
    `UPDATE subtasks s SET
       title     = COALESCE($1, s.title),
       completed = COALESCE($2, s.completed)
     FROM tasks t WHERE s.id=$3 AND s.task_id=t.id AND t.user_id=$4
     RETURNING s.*`,
    [title, completed, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.delete('/api/subtasks/:id', auth, async (req, res) => {
  await pool.query(
    `DELETE FROM subtasks s USING tasks t
     WHERE s.id=$1 AND s.task_id=t.id AND t.user_id=$2`,
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// ─── Habits ───────────────────────────────────────────────────────────────────
app.get('/api/habits', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM habits WHERE user_id=$1 AND active=TRUE ORDER BY created_at ASC',
    [req.user.id]
  );
  res.json(rows);
});

app.post('/api/habits', auth, async (req, res) => {
  const { name, emoji = '✅' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { rows } = await pool.query(
    'INSERT INTO habits (user_id, name, emoji) VALUES ($1,$2,$3) RETURNING *',
    [req.user.id, name, emoji]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/habits/:id', auth, async (req, res) => {
  const { name, emoji, active } = req.body;
  const { rows } = await pool.query(
    `UPDATE habits SET
       name   = COALESCE($1, name),
       emoji  = COALESCE($2, emoji),
       active = COALESCE($3, active)
     WHERE id=$4 AND user_id=$5 RETURNING *`,
    [name, emoji, active, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.delete('/api/habits/:id', auth, async (req, res) => {
  await pool.query(
    'UPDATE habits SET active=FALSE WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// ─── Habit Logs ───────────────────────────────────────────────────────────────
// Returns all logs for the user in a given month: ?year=2026&month=6
app.get('/api/habit-logs', auth, async (req, res) => {
  const { year, month } = req.query;
  const { rows } = await pool.query(
    `SELECT hl.habit_id, hl.log_date
     FROM habit_logs hl
     JOIN habits h ON h.id=hl.habit_id
     WHERE hl.user_id=$1
       AND EXTRACT(YEAR  FROM hl.log_date)=$2
       AND EXTRACT(MONTH FROM hl.log_date)=$3`,
    [req.user.id, year, month]
  );
  res.json(rows);
});

// Toggle: POST body { habit_id, log_date }  → creates or deletes the log row
app.post('/api/habit-logs/toggle', auth, async (req, res) => {
  const { habit_id, log_date } = req.body;
  if (!habit_id || !log_date) return res.status(400).json({ error: 'habit_id and log_date required' });

  // Verify habit belongs to user
  const check = await pool.query('SELECT id FROM habits WHERE id=$1 AND user_id=$2', [habit_id, req.user.id]);
  if (!check.rows[0]) return res.status(404).json({ error: 'Habit not found' });

  // Check existing
  const existing = await pool.query(
    'SELECT id FROM habit_logs WHERE habit_id=$1 AND log_date=$2', [habit_id, log_date]
  );
  if (existing.rows[0]) {
    await pool.query('DELETE FROM habit_logs WHERE id=$1', [existing.rows[0].id]);
    res.json({ toggled: false });
  } else {
    await pool.query(
      'INSERT INTO habit_logs (habit_id, user_id, log_date) VALUES ($1,$2,$3)',
      [habit_id, req.user.id, log_date]
    );
    res.json({ toggled: true });
  }
});

// Streak data for a habit
app.get('/api/habits/:id/streak', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT log_date FROM habit_logs
     WHERE habit_id=$1 AND user_id=$2
     ORDER BY log_date DESC`,
    [req.params.id, req.user.id]
  );

  const dates = rows.map(r => r.log_date.toISOString().slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);

  // Current streak
  let current = 0;
  let d = new Date(today);
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (dates.includes(ds)) { current++; d.setDate(d.getDate() - 1); }
    else break;
  }

  // Longest streak
  let longest = 0, run = 0;
  const sorted = [...dates].sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { run = 1; }
    else {
      const prev = new Date(sorted[i - 1]);
      const cur  = new Date(sorted[i]);
      const diff = (cur - prev) / 86400000;
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  res.json({ current, longest });
});

// ─── Pomodoro Sessions ────────────────────────────────────────────────────────
app.post('/api/pomodoro-sessions', auth, async (req, res) => {
  const { task_id, duration_minutes = 25, session_type = 'focus', completed = false } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO pomodoro_sessions (user_id, task_id, duration_minutes, session_type, completed, completed_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 THEN NOW() ELSE NULL END) RETURNING *`,
    [req.user.id, task_id || null, duration_minutes, session_type, completed]
  );

  // Increment pomodoro_count on the linked task
  if (completed && task_id) {
    await pool.query(
      'UPDATE tasks SET pomodoro_count=pomodoro_count+1 WHERE id=$1 AND user_id=$2',
      [task_id, req.user.id]
    );
  }

  res.status(201).json(rows[0]);
});

app.patch('/api/pomodoro-sessions/:id/complete', auth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE pomodoro_sessions SET completed=TRUE, completed_at=NOW()
     WHERE id=$1 AND user_id=$2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });

  if (rows[0].task_id) {
    await pool.query(
      'UPDATE tasks SET pomodoro_count=pomodoro_count+1 WHERE id=$1 AND user_id=$2',
      [rows[0].task_id, req.user.id]
    );
  }
  res.json(rows[0]);
});

app.get('/api/pomodoro-sessions', auth, async (req, res) => {
  const { task_id } = req.query;
  let q = 'SELECT * FROM pomodoro_sessions WHERE user_id=$1';
  const params = [req.user.id];
  if (task_id) { q += ' AND task_id=$2'; params.push(task_id); }
  q += ' ORDER BY started_at DESC LIMIT 100';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
