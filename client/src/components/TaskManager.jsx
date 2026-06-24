import { useState, useEffect, useRef } from 'react';
import { tasks as tasksApi, lists as listsApi } from '../api.js';
import TaskDetail from './TaskDetail.jsx';

const PRIORITY_STYLES = {
  high:   { badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',   dot: 'bg-red-500',    label: 'High' },
  medium: { badge: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', dot: 'bg-amber-500', label: 'Medium' },
  low:    { badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',  dot: 'bg-blue-400',   label: 'Low' },
  none:   { badge: '',   dot: 'bg-gray-300',   label: 'None' },
};

const VIEW_TITLES = {
  inbox:    { label: 'Inbox',    emoji: '📥' },
  today:    { label: 'Today',    emoji: '☀️' },
  tomorrow: { label: 'Tomorrow', emoji: '🌤️' },
};

export default function TaskManager({ view }) {
  const [taskList,    setTaskList]    = useState([]);
  const [myLists,     setMyLists]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [addingTask,  setAddingTask]  = useState(false);
  const [newTask,     setNewTask]     = useState({ title: '', due_date: '', priority: 'none', tags: '' });
  const addInputRef = useRef(null);

  // Derive list_id if view is "list-{id}"
  const listId = view.startsWith('list-') ? view.replace('list-', '') : null;
  const listObj = listId ? myLists.find(l => String(l.id) === listId) : null;

  const titleInfo = listId
    ? { label: listObj?.name || 'List', emoji: '📋' }
    : VIEW_TITLES[view] || { label: view, emoji: '📋' };

  // Fetch
  useEffect(() => {
    listsApi.all().then(setMyLists).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelectedTask(null);
    const params = listId
      ? { list_id: listId }
      : view === 'inbox' ? {} : { filter: view };
    tasksApi.all(params)
      .then(setTaskList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [view]);

  useEffect(() => {
    if (addingTask) addInputRef.current?.focus();
  }, [addingTask]);

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  async function createTask(e) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    const tags = newTask.tags ? newTask.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const body = {
      title:    newTask.title.trim(),
      due_date: newTask.due_date || null,
      priority: newTask.priority,
      tags,
      list_id:  listId || null,
    };
    const created = await tasksApi.create(body);
    setTaskList(prev => [created, ...prev]);
    setNewTask({ title: '', due_date: '', priority: 'none', tags: '' });
    setAddingTask(false);
  }

  async function toggleComplete(task) {
    const updated = await tasksApi.update(task.id, { completed: !task.completed });
    setTaskList(prev => prev.map(t => t.id === task.id ? updated : t));
    if (selectedTask?.id === task.id) setSelectedTask(updated);
  }

  async function deleteTask(id) {
    await tasksApi.remove(id);
    setTaskList(prev => prev.filter(t => t.id !== id));
    if (selectedTask?.id === id) setSelectedTask(null);
  }

  function refreshTask(updated) {
    setTaskList(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTask(updated);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const pending   = taskList.filter(t => !t.completed);
  const completed = taskList.filter(t =>  t.completed);

  return (
    <div className="flex h-full">
      {/* Task list column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{titleInfo.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{titleInfo.label}</h1>
              {listObj && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: listObj.color }} />
                  <span className="text-xs text-gray-400">{pending.length} tasks</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setAddingTask(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span> Add task
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4 scrollbar-thin">
          {/* Add task form */}
          {addingTask && (
            <form onSubmit={createTask} className="mb-4 bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-900/50 rounded-xl p-4 shadow-sm space-y-3">
              <input
                ref={addInputRef}
                value={newTask.title}
                onChange={e => setNewTask(n => ({ ...n, title: e.target.value }))}
                placeholder="Task title…"
                className="w-full text-sm bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 font-medium"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={e => setNewTask(n => ({ ...n, due_date: e.target.value }))}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask(n => ({ ...n, priority: e.target.value }))}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="none">No priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  value={newTask.tags}
                  onChange={e => setNewTask(n => ({ ...n, tags: e.target.value }))}
                  placeholder="Tags (comma separated)"
                  className="text-xs px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 flex-1 min-w-24"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">Add</button>
                <button type="button" onClick={() => setAddingTask(false)} className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
          ) : taskList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
              <span className="text-4xl">🎉</span>
              <p className="text-sm">All clear! Add a task above.</p>
            </div>
          ) : (
            <>
              <TaskList
                tasks={pending}
                selectedId={selectedTask?.id}
                onSelect={setSelectedTask}
                onToggle={toggleComplete}
                onDelete={deleteTask}
              />

              {completed.length > 0 && (
                <CompletedSection
                  tasks={completed}
                  selectedId={selectedTask?.id}
                  onSelect={setSelectedTask}
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          lists={myLists}
          onClose={() => setSelectedTask(null)}
          onUpdate={refreshTask}
          onDelete={deleteTask}
        />
      )}
    </div>
  );
}

// ── TaskList ─────────────────────────────────────────────────────────────────
function TaskList({ tasks, selectedId, onSelect, onToggle, onDelete }) {
  return (
    <ul className="space-y-1">
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          selected={selectedId === task.id}
          onSelect={onSelect}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function CompletedSection({ tasks, selectedId, onSelect, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-2 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Completed ({tasks.length})
      </button>
      {open && (
        <ul className="space-y-1">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              selected={selectedId === task.id}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, selected, onSelect, onToggle, onDelete }) {
  const p = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.none;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.due_date && task.due_date < today && !task.completed;

  return (
    <li
      onClick={() => onSelect(task)}
      className={`group flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors
        ${selected
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'}`}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(task); }}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
          ${task.completed
            ? 'bg-primary-500 border-primary-500 check-animate'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-500'}`}
      >
        {task.completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {task.due_date && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
              📅 {task.due_date}
            </span>
          )}
          {task.priority !== 'none' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.badge}`}>
              {p.label}
            </span>
          )}
          {(task.tags || []).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
              #{tag}
            </span>
          ))}
          {task.pomodoro_count > 0 && (
            <span className="text-xs text-orange-500">🍅 {task.pomodoro_count}</span>
          )}
          {(task.subtasks?.length > 0) && (
            <span className="text-xs text-gray-400">
              ☑ {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(task.id); }}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
        title="Delete task"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}
