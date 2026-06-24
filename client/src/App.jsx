import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Auth       from './components/Auth.jsx';
import Sidebar    from './components/Sidebar.jsx';
import TaskManager from './components/TaskManager.jsx';
import HabitTracker from './components/HabitTracker.jsx';
import PomodoroTimer from './components/PomodoroTimer.jsx';

function Shell() {
  const { user, loading, updateUser } = useAuth();

  // Dark mode — read from user preference + localStorage
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('dark_mode');
    return stored !== null ? stored === 'true' : false;
  });

  useEffect(() => {
    if (user?.dark_mode !== undefined && localStorage.getItem('dark_mode') === null) {
      setDark(user.dark_mode);
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dark_mode', dark);
    if (user) updateUser({ dark_mode: dark }).catch(() => {});
  }, [dark]);

  // View state
  const [view,   setView]   = useState('inbox');  // inbox | today | tomorrow | habits | timer | list-{id}
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'} flex-shrink-0 transition-all duration-200`}>
        <Sidebar
          view={view}
          setView={setView}
          dark={dark}
          setDark={setDark}
        />
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(v => !v)}
        className="absolute top-4 left-4 z-20 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
        title="Toggle sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Main area */}
      <main className="flex-1 overflow-hidden">
        {view === 'habits' ? (
          <HabitTracker />
        ) : view === 'timer' ? (
          <PomodoroTimer />
        ) : (
          <TaskManager view={view} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
