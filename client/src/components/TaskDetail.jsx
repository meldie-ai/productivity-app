import { useState, useEffect, useRef } from 'react';
import { tasks as tasksApi, subtasks as subtasksApi } from '../api.js';

const PRIORITIES = ['none', 'low', 'medium', 'high'];
const PRIORITY_COLORS = {
  none: 'text-gray-400',
  low:  'text-blue-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
};

export default function TaskDetail({ task, lists, onClose, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    title:    task.title,
    notes:    task.notes || '',
    due_date: task.due_date || '',
    priority: task.priority,
    tags:     (task.tags || []).join(', '),
    list_id:  task.list_id || '',
  });
  const [newSubtask,  setNewSubtask]  = useState('');
  const [subtasks,    setSubtasks]    = useState(task.subtasks || []);
  const [saving,      setSaving]      = useState(false);
  const saveTimer = useRef(null);

  // Sync when task changes
  useEffect(() => {
    setForm({
      title:    task.title,
      notes:    task.notes || '',
      due_date: task.due_date || '',
      priority: task.priority,
      tags:     (task.tags || []).join(', '),
      list_id:  task.list_id || '',
    });
    setSubtasks(task.subtasks || []);
  }, [task.id]);

  // Auto-save debounce
  function change(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveField(field, value), 800);
  }

  async function saveField(field, value) {
    setSaving(true);
    const payload = { [field]: value };
    if (field === 'tags') payload.tags = value.split(',').map(t => t.trim()).filter(Boolean);
    if (field === 'list_id') payload.list_id = value || null;
    try {
      const updated = await tasksApi.update(task.id, payload);
      onUpdate(updated);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  }

  // Subtask operations
  async function addSubtask(e) {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    const s = await subtasksApi.create(task.id, { title: newSubtask.trim() });
    const updated = [...subtasks, s];
    setSubtasks(updated);
    setNewSubtask('');
    // propagate to parent
    onUpdate({ ...task, subtasks: updated });
  }

  async function toggleSubtask(s) {
    const updated = await subtasksApi.update(s.id, { completed: !s.completed });
    const next = subtasks.map(x => x.id === s.id ? updated : x);
    setSubtasks(next);
    onUpdate({ ...task, subtasks: next });
  }

  async function deleteSubtask(id) {
    await subtasksApi.remove(id);
    const next = subtasks.filter(s => s.id !== id);
    setSubtasks(next);
    onUpdate({ ...task, subtasks: next });
  }

  return (
    <div className="slide-in w-80 flex-shrink-0 h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
        <input
          value={form.title}
          onChange={e => change('title', e.target.value)}
          className="flex-1 text-base font-semibold bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 leading-snug"
          placeholder="Task title"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <span className="text-xs text-gray-400 animate-pulse">Saving…</span>}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
        {/* Meta fields */}
        <div className="space-y-3">
          {/* Due date */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-20 flex-shrink-0">📅 Due date</span>
            <input
              type="date"
              value={form.due_date}
              onChange={e => change('due_date', e.target.value)}
              className="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-700 dark:text-gray-300"
            />
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-20 flex-shrink-0">🚩 Priority</span>
            <div className="flex gap-1.5">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => change('priority', p)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all capitalize
                    ${form.priority === p
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-300'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-20 flex-shrink-0">📋 List</span>
            <select
              value={form.list_id}
              onChange={e => change('list_id', e.target.value)}
              className="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-700 dark:text-gray-300"
            >
              <option value="">Inbox</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-20 flex-shrink-0">🏷️ Tags</span>
            <input
              value={form.tags}
              onChange={e => change('tags', e.target.value)}
              placeholder="work, urgent…"
              className="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-700 dark:text-gray-300"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
          <textarea
            value={form.notes}
            onChange={e => change('notes', e.target.value)}
            placeholder="Add notes…"
            rows={4}
            className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none text-gray-700 dark:text-gray-300 leading-relaxed"
          />
        </div>

        {/* Subtasks */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
          </p>
          <ul className="space-y-1.5 mb-3">
            {subtasks.map(s => (
              <li key={s.id} className="group flex items-center gap-2">
                <button
                  onClick={() => toggleSubtask(s)}
                  className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all
                    ${s.completed ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600 hover:border-primary-500'}`}
                >
                  {s.completed && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${s.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {s.title}
                </span>
                <button
                  onClick={() => deleteSubtask(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addSubtask} className="flex gap-2">
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              placeholder="Add subtask…"
              className="flex-1 text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-700 dark:text-gray-300"
            />
            <button type="submit" className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm transition-colors">+</button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {task.pomodoro_count > 0 && `🍅 ${task.pomodoro_count} pomodoro${task.pomodoro_count > 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
        >
          🗑 Delete task
        </button>
      </div>
    </div>
  );
}
