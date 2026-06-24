import { useState, useEffect, useRef, useCallback } from 'react';
import { tasks as tasksApi, pomodoro as pomodoroApi } from '../api.js';

const MODES = {
  focus:       { label: 'Focus',       minutes: 25, color: '#4772FA' },
  short_break: { label: 'Short Break', minutes: 5,  color: '#22C55E' },
  long_break:  { label: 'Long Break',  minutes: 15, color: '#F97316' },
};

const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PomodoroTimer() {
  const [mode,       setMode]       = useState('focus');
  const [timeLeft,   setTimeLeft]   = useState(MODES.focus.minutes * 60);
  const [running,    setRunning]    = useState(false);
  const [allTasks,   setAllTasks]   = useState([]);
  const [linkedTask, setLinkedTask] = useState('');
  const [sessionId,  setSessionId]  = useState(null);
  const [sessions,   setSessions]   = useState([]); // completed today
  const [pomoCounts, setPomoCounts] = useState({}); // { taskId: count }

  const intervalRef = useRef(null);
  const notifRef    = useRef(null);

  const totalSeconds = MODES[mode].minutes * 60;
  const progress     = timeLeft / totalSeconds;
  const strokeOffset = CIRCUMFERENCE * (1 - progress);

  // Load tasks + today's sessions
  useEffect(() => {
    tasksApi.all().then(t => {
      setAllTasks(t.filter(x => !x.completed));
      const counts = {};
      t.forEach(x => { if (x.pomodoro_count > 0) counts[x.id] = x.pomodoro_count; });
      setPomoCounts(counts);
    });
    pomodoroApi.list().then(s => {
      const todaySessions = s.filter(x => x.session_type === 'focus' && x.completed);
      setSessions(todaySessions);
    });
  }, []);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            handleComplete();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  async function handleComplete() {
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('TickFlow', {
        body: mode === 'focus' ? '🍅 Focus session complete! Time for a break.' : '⏰ Break over. Back to focus!',
        icon: '/favicon.ico',
      });
    }

    if (mode === 'focus') {
      let sid = sessionId;
      // Complete session in DB
      if (sid) {
        await pomodoroApi.complete(sid).catch(console.error);
      } else {
        // Create + complete in one shot
        const s = await pomodoroApi.create({
          task_id: linkedTask || null,
          duration_minutes: MODES.focus.minutes,
          session_type: 'focus',
          completed: true,
        }).catch(console.error);
        sid = s?.id;
      }
      setSessionId(null);

      // Update local counts
      if (linkedTask) {
        setPomoCounts(prev => ({ ...prev, [linkedTask]: (prev[linkedTask] || 0) + 1 }));
      }
      // Refresh sessions list
      pomodoroApi.list().then(s => setSessions(s.filter(x => x.session_type === 'focus' && x.completed)));
    }
  }

  async function startTimer() {
    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Create session record for focus sessions
    if (mode === 'focus' && !sessionId) {
      const s = await pomodoroApi.create({
        task_id: linkedTask || null,
        duration_minutes: MODES[mode].minutes,
        session_type: mode,
        completed: false,
      }).catch(console.error);
      if (s) setSessionId(s.id);
    }
    setRunning(true);
  }

  function pauseTimer() {
    setRunning(false);
  }

  function resetTimer() {
    setRunning(false);
    setSessionId(null);
    setTimeLeft(MODES[mode].minutes * 60);
  }

  function switchMode(newMode) {
    setRunning(false);
    setSessionId(null);
    setMode(newMode);
    setTimeLeft(MODES[newMode].minutes * 60);
  }

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const accent = MODES[mode].color;

  // Today's pomodoro count
  const todayCount = sessions.length;
  const linkedTaskObj = allTasks.find(t => String(t.id) === String(linkedTask));

  return (
    <div className="h-full flex flex-col items-center justify-start overflow-y-auto py-12 px-4">
      <div className="w-full max-w-md">
        {/* Mode tabs */}
        <div className="flex gap-2 justify-center mb-10">
          {Object.entries(MODES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => switchMode(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${mode === key
                  ? 'bg-white dark:bg-gray-700 shadow-md text-gray-800 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {val.label}
            </button>
          ))}
        </div>

        {/* Timer ring */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative w-56 h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={RADIUS} fill="none" strokeWidth="10" className="timer-ring-bg" />
              <circle
                cx="100" cy="100" r={RADIUS}
                fill="none" strokeWidth="10"
                stroke={accent}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeOffset}
                style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-bold tabular-nums text-gray-800 dark:text-white tracking-tight">
                {mm}:{ss}
              </div>
              <div className="text-sm text-gray-400 mt-1">{MODES[mode].label}</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={resetTimer}
            className="p-3 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            title="Reset"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={running ? pauseTimer : startTimer}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95"
            style={{ backgroundColor: accent }}
          >
            {running ? (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/30 flex flex-col items-center justify-center" title={`${todayCount} sessions today`}>
            <span className="text-lg leading-none">🍅</span>
            <span className="text-xs font-bold text-orange-500">{todayCount}</span>
          </div>
        </div>

        {/* Link task */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Link to task</p>
          <select
            value={linkedTask}
            onChange={e => setLinkedTask(e.target.value)}
            disabled={running}
            className="w-full text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          >
            <option value="">— No task linked —</option>
            {allTasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.title} {pomoCounts[t.id] ? `(🍅×${pomoCounts[t.id]})` : ''}
              </option>
            ))}
          </select>
          {linkedTaskObj && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>🍅</span>
              <span>{pomoCounts[linkedTask] || 0} pomodoro{(pomoCounts[linkedTask] || 0) !== 1 ? 's' : ''} logged</span>
              {linkedTaskObj.priority !== 'none' && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full
                  ${linkedTaskObj.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                    linkedTaskObj.priority === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' :
                    'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                  {linkedTaskObj.priority}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today's sessions</p>
            <div className="flex flex-wrap gap-2">
              {sessions.slice(0, 12).map((s, i) => (
                <div
                  key={s.id}
                  className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-lg"
                  title={`Session ${i + 1}${s.task_id ? ` – task #${s.task_id}` : ''}`}
                >
                  🍅
                </div>
              ))}
              {sessions.length > 12 && (
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 font-medium">
                  +{sessions.length - 12}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {sessions.length * 25} minutes of focus today
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
