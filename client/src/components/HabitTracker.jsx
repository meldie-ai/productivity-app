import { useState, useEffect } from 'react';
import { habits as habitsApi, habitLogs } from '../api.js';

const EMOJIS = ['✅','🏃','💊','📚','📵','💧','🧘','🍎','💪','📝','🎯','🛌','🧹','🌿','☕'];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function pad(n) { return String(n).padStart(2, '0'); }

export default function HabitTracker() {
  const now = new Date();
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth() + 1); // 1-12
  const [myHabits, setMyHabits] = useState([]);
  const [logs,   setLogs]   = useState({}); // { "habitId-YYYY-MM-DD": true }
  const [streaks, setStreaks] = useState({}); // { habitId: { current, longest } }
  const [adding, setAdding] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', emoji: '✅' });
  const [editHabit, setEditHabit] = useState(null);

  const daysInMonth = getDaysInMonth(year, month);
  const today = now.toISOString().slice(0, 10);

  useEffect(() => {
    habitsApi.all().then(h => {
      setMyHabits(h);
      // Fetch streaks for all habits
      h.forEach(habit => {
        habitsApi.streak(habit.id).then(s => {
          setStreaks(prev => ({ ...prev, [habit.id]: s }));
        });
      });
    });
  }, []);

  useEffect(() => {
    habitLogs.forMonth(year, month).then(data => {
      const map = {};
      data.forEach(log => {
        const key = `${log.habit_id}-${log.log_date.slice(0, 10)}`;
        map[key] = true;
      });
      setLogs(map);
    });
  }, [year, month]);

  async function toggleLog(habitId, day) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const key = `${habitId}-${dateStr}`;
    const result = await habitLogs.toggle({ habit_id: habitId, log_date: dateStr });
    setLogs(prev => {
      const next = { ...prev };
      if (result.toggled) next[key] = true;
      else delete next[key];
      return next;
    });
    // Refresh streak
    habitsApi.streak(habitId).then(s => setStreaks(prev => ({ ...prev, [habitId]: s })));
  }

  async function createHabit(e) {
    e.preventDefault();
    if (!newHabit.name.trim()) return;
    const h = await habitsApi.create(newHabit);
    setMyHabits(prev => [...prev, h]);
    setStreaks(prev => ({ ...prev, [h.id]: { current: 0, longest: 0 } }));
    setNewHabit({ name: '', emoji: '✅' });
    setAdding(false);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const updated = await habitsApi.update(editHabit.id, { name: editHabit.name, emoji: editHabit.emoji });
    setMyHabits(prev => prev.map(h => h.id === updated.id ? updated : h));
    setEditHabit(null);
  }

  async function removeHabit(id) {
    if (!confirm('Delete this habit?')) return;
    await habitsApi.remove(id);
    setMyHabits(prev => prev.filter(h => h.id !== id));
  }

  // Completion % for the current month (up to today)
  function completionPct(habitId) {
    const totalDays = month === now.getMonth() + 1 && year === now.getFullYear()
      ? now.getDate()
      : daysInMonth;
    let count = 0;
    for (let d = 1; d <= totalDays; d++) {
      const key = `${habitId}-${year}-${pad(month)}-${pad(d)}`;
      if (logs[key]) count++;
    }
    return totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Habits</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-1.5">
            <button
              onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >◀</button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-28 text-center">
              {monthName} {year}
            </span>
            <button
              onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >▶</button>
          </div>
          <button
            onClick={() => setAdding(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            + Add habit
          </button>
        </div>
      </div>

      {/* Add habit form */}
      {adding && (
        <div className="px-8 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <form onSubmit={createHabit} className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={newHabit.emoji}
                onChange={e => setNewHabit(n => ({ ...n, emoji: e.target.value }))}
                className="appearance-none w-12 h-10 text-xl text-center border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer focus:outline-none"
              >
                {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
            <input
              autoFocus
              value={newHabit.name}
              onChange={e => setNewHabit(n => ({ ...n, name: e.target.value }))}
              placeholder="Habit name…"
              className="flex-1 min-w-40 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button type="submit" className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg text-sm">Cancel</button>
          </form>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto px-4 py-4 scrollbar-thin">
        {myHabits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
            <span className="text-4xl">🔥</span>
            <p className="text-sm">No habits yet. Add one above!</p>
          </div>
        ) : (
          <div className="min-w-max">
            {/* Day headers */}
            <div className="flex sticky top-0 bg-white dark:bg-gray-900 z-10 pb-1">
              <div className="w-52 flex-shrink-0" />
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const ds = `${year}-${pad(month)}-${pad(day)}`;
                const isToday = ds === today;
                const dateObj = new Date(year, month - 1, day);
                const dow = ['S','M','T','W','T','F','S'][dateObj.getDay()];
                return (
                  <div
                    key={day}
                    className={`w-8 mx-0.5 text-center flex-shrink-0 ${isToday ? 'text-primary-500 font-bold' : 'text-gray-400'}`}
                  >
                    <div className="text-xs">{dow}</div>
                    <div className="text-xs">{day}</div>
                  </div>
                );
              })}
              <div className="w-28 flex-shrink-0 text-xs text-gray-400 text-center pl-2">Streak / %</div>
            </div>

            {/* Habit rows */}
            {myHabits.map(habit => {
              const streak = streaks[habit.id] || { current: 0, longest: 0 };
              const pct    = completionPct(habit.id);
              return (
                <div key={habit.id} className="flex items-center mb-1 group">
                  {/* Habit name */}
                  <div className="w-52 flex-shrink-0 flex items-center gap-2 pr-3">
                    {editHabit?.id === habit.id ? (
                      <form onSubmit={saveEdit} className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                        <select
                          value={editHabit.emoji}
                          onChange={e => setEditHabit(h => ({ ...h, emoji: e.target.value }))}
                          className="w-8 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:outline-none"
                        >
                          {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                        </select>
                        <input
                          autoFocus
                          value={editHabit.name}
                          onChange={e => setEditHabit(h => ({ ...h, name: e.target.value }))}
                          className="flex-1 text-xs px-1.5 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:outline-none"
                        />
                        <button type="submit" className="text-xs text-primary-500 font-medium">✓</button>
                        <button type="button" onClick={() => setEditHabit(null)} className="text-xs text-gray-400">✕</button>
                      </form>
                    ) : (
                      <>
                        <span className="text-lg leading-none">{habit.emoji}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{habit.name}</span>
                        <span className="hidden group-hover:flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditHabit(habit)} className="text-gray-300 hover:text-primary-500 text-xs">✏️</button>
                          <button onClick={() => removeHabit(habit.id)} className="text-gray-300 hover:text-red-500 text-xs">🗑️</button>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const ds  = `${year}-${pad(month)}-${pad(day)}`;
                    const key = `${habit.id}-${ds}`;
                    const done = !!logs[key];
                    const isFuture = ds > today;
                    return (
                      <button
                        key={day}
                        onClick={() => !isFuture && toggleLog(habit.id, day)}
                        disabled={isFuture}
                        className={`w-8 h-8 flex-shrink-0 rounded-lg mx-0.5 transition-all text-xs font-medium
                          ${isFuture ? 'opacity-25 cursor-default' : 'cursor-pointer hover:opacity-80'}
                          ${done
                            ? 'bg-primary-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-300'}`}
                      >
                        {done ? '✓' : ''}
                      </button>
                    );
                  })}

                  {/* Stats */}
                  <div className="w-28 flex-shrink-0 flex items-center gap-2 pl-3">
                    <div className="text-center">
                      <div className="text-xs font-semibold text-orange-500">{streak.current}🔥</div>
                      <div className="text-xs text-gray-400">best {streak.longest}</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right mb-0.5">{pct}%</div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
