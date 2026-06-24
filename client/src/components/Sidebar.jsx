import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { lists as listsApi } from '../api.js';

const NAV = [
  { id: 'inbox',    label: 'Inbox',    emoji: '📥' },
  { id: 'today',    label: 'Today',    emoji: '☀️' },
  { id: 'tomorrow', label: 'Tomorrow', emoji: '🌤️' },
  { id: 'habits',   label: 'Habits',   emoji: '🔥' },
  { id: 'timer',    label: 'Focus',    emoji: '🍅' },
];

const LIST_COLORS = ['#4772FA','#F97316','#22C55E','#EAB308','#EC4899','#8B5CF6','#14B8A6'];

export default function Sidebar({ view, setView, dark, setDark }) {
  const { user, logout } = useAuth();
  const [myLists,    setMyLists]    = useState([]);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('#4772FA');
  const [editList,   setEditList]   = useState(null);  // {id,name,color,icon}

  useEffect(() => {
    listsApi.all().then(setMyLists).catch(console.error);
  }, []);

  async function createList(e) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const l = await listsApi.create({ name: newListName.trim(), color: newListColor });
    setMyLists(prev => [...prev, l]);
    setNewListName('');
    setShowNewList(false);
  }

  async function saveEditList(e) {
    e.preventDefault();
    const updated = await listsApi.update(editList.id, { name: editList.name, color: editList.color });
    setMyLists(prev => prev.map(l => l.id === updated.id ? updated : l));
    setEditList(null);
  }

  async function removeList(id) {
    if (!confirm('Delete this list and all its tasks?')) return;
    await listsApi.remove(id);
    setMyLists(prev => prev.filter(l => l.id !== id));
    if (view === `list-${id}`) setView('inbox');
  }

  return (
    <aside className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 select-none">
      {/* User badge */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {(user?.name || user?.email || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{user?.name || 'Me'}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {/* Static nav */}
        <ul className="space-y-0.5 mb-4">
          {NAV.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${view === item.id
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
              >
                <span className="text-base leading-none">{item.emoji}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Lists section */}
        <div className="mb-2">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Lists</span>
            <button
              onClick={() => setShowNewList(v => !v)}
              className="text-gray-400 hover:text-primary-500 transition-colors text-lg leading-none"
              title="New list"
            >+</button>
          </div>

          {showNewList && (
            <form onSubmit={createList} className="px-3 mb-2 space-y-2">
              <input
                autoFocus
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="List name…"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex gap-1 flex-wrap">
                {LIST_COLORS.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setNewListColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${newListColor === c ? 'border-gray-800 dark:border-white scale-125' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-1 bg-primary-500 text-white text-xs rounded-md font-medium">Add</button>
                <button type="button" onClick={() => setShowNewList(false)} className="flex-1 py-1 bg-gray-200 dark:bg-gray-700 text-xs rounded-md">Cancel</button>
              </div>
            </form>
          )}

          <ul className="space-y-0.5">
            {myLists.map(list => (
              <li key={list.id}>
                {editList?.id === list.id ? (
                  <form onSubmit={saveEditList} className="px-3 py-1 space-y-1">
                    <input
                      autoFocus
                      value={editList.name}
                      onChange={e => setEditList(l => ({ ...l, name: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:outline-none"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {LIST_COLORS.map(c => (
                        <button
                          key={c} type="button"
                          onClick={() => setEditList(l => ({ ...l, color: c }))}
                          className={`w-4 h-4 rounded-full border-2 ${editList.color === c ? 'border-gray-700 dark:border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button type="submit" className="flex-1 py-0.5 text-xs bg-primary-500 text-white rounded">Save</button>
                      <button type="button" onClick={() => setEditList(null)} className="flex-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setView(`list-${list.id}`)}
                    className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                      ${view === `list-${list.id}`
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 font-medium'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: list.color }} />
                    <span className="flex-1 truncate text-left">{list.name}</span>
                    <span className="hidden group-hover:flex gap-1">
                      <span
                        onClick={e => { e.stopPropagation(); setEditList(list); }}
                        className="text-gray-400 hover:text-primary-500 text-xs px-1"
                        title="Edit"
                      >✏️</span>
                      <span
                        onClick={e => { e.stopPropagation(); removeList(list.id); }}
                        className="text-gray-400 hover:text-red-500 text-xs px-1"
                        title="Delete"
                      >🗑️</span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={() => setDark(d => !d)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
