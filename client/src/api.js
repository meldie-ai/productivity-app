const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  register: (data)   => req('POST', '/auth/register', data),
  login:    (data)   => req('POST', '/auth/login',    data),
  me:       ()       => req('GET',  '/auth/me'),
  update:   (data)   => req('PATCH','/auth/me',       data),
};

// ─── Lists ────────────────────────────────────────────────────────────────────
export const lists = {
  all:    ()         => req('GET',    '/lists'),
  create: (data)     => req('POST',   '/lists',      data),
  update: (id, data) => req('PUT',    `/lists/${id}`, data),
  remove: (id)       => req('DELETE', `/lists/${id}`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasks = {
  all:    (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req('GET', `/tasks${qs ? '?' + qs : ''}`);
  },
  get:    (id)       => req('GET',    `/tasks/${id}`),
  create: (data)     => req('POST',   '/tasks',       data),
  update: (id, data) => req('PUT',    `/tasks/${id}`,  data),
  remove: (id)       => req('DELETE', `/tasks/${id}`),
};

// ─── Subtasks ─────────────────────────────────────────────────────────────────
export const subtasks = {
  create: (taskId, data) => req('POST',   `/tasks/${taskId}/subtasks`, data),
  update: (id, data)     => req('PUT',    `/subtasks/${id}`,           data),
  remove: (id)           => req('DELETE', `/subtasks/${id}`),
};

// ─── Habits ───────────────────────────────────────────────────────────────────
export const habits = {
  all:    ()         => req('GET',    '/habits'),
  create: (data)     => req('POST',   '/habits',       data),
  update: (id, data) => req('PUT',    `/habits/${id}`,  data),
  remove: (id)       => req('DELETE', `/habits/${id}`),
  streak: (id)       => req('GET',    `/habits/${id}/streak`),
};

// ─── Habit Logs ───────────────────────────────────────────────────────────────
export const habitLogs = {
  forMonth: (year, month) => req('GET', `/habit-logs?year=${year}&month=${month}`),
  toggle:   (data)        => req('POST', '/habit-logs/toggle', data),
};

// ─── Pomodoro ─────────────────────────────────────────────────────────────────
export const pomodoro = {
  create:   (data) => req('POST',  '/pomodoro-sessions',          data),
  complete: (id)   => req('PATCH', `/pomodoro-sessions/${id}/complete`),
  list:     (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req('GET', `/pomodoro-sessions${qs ? '?' + qs : ''}`);
  },
};
