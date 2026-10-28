import './Auth.css';
import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase.js';
import Auth from './Auth.jsx';
import './App.css';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const tasksQuery = query(tasksRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })));
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error(err);
        setError('Tasks load nahi hue. Firebase Firestore Rules check karein.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const weeklyData = useMemo(() => {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    const count = tasks.filter((task) => {
      if (!task.completedAt) return false;

      const completedDate = task.completedAt.toDate
        ? task.completedAt.toDate()
        : new Date(task.completedAt);

      return completedDate.toDateString() === date.toDateString();
    }).length;

    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count,
    };
  });
}, [tasks]);

const maxWeeklyCount = Math.max(
  1,
  ...weeklyData.map((item) => item.count)
);

  // Browser reminders for tasks due today (permission is requested only after user opts in).
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  useEffect(() => {
    if (!remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = tasks.filter((task) => task.dueDate === today && !task.completed);
    if (dueToday.length) {
      const key = `taskflow-reminder-${today}-${user?.uid}`;
      if (!sessionStorage.getItem(key)) {
        new Notification('TaskFlow reminder', { body: `${dueToday.length} task(s) due today. Open TaskFlow to review.` });
        sessionStorage.setItem(key, 'shown');
      }
    }
  }, [remindersEnabled, tasks, user]);

  async function enableReminders() {
    if (!('Notification' in window)) { setError('Is browser mein notifications supported nahi hain.'); return; }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') setRemindersEnabled(true);
    else setError('Reminder ke liye browser notification permission allow karein.');
  }

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarOffset = (monthStart.getDay() + 6) % 7;
  const tasksByDate = tasks.reduce((map, task) => {
    if (task.dueDate) map[task.dueDate] = [...(map[task.dueDate] || []), task];
    return map;
  }, {});
  
    

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        (task.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === 'All' ||
        (filter === 'Completed' && task.completed) ||
        (filter === 'Pending' && !task.completed);

      return matchesSearch && matchesFilter;
    });
  }, [tasks, search, filter]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setDueDate('');
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) {
      setError('Please task ka title likhein.');
      return;
    }

    if (!user) return;

    setTaskLoading(true);
    setError('');

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      updatedAt: serverTimestamp(),
    };

    try {
      const tasksRef = collection(db, 'users', user.uid, 'tasks');

      if (editingId) {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', editingId), taskData);
      } else {
        await addDoc(tasksRef, {
          ...taskData,
          completed: false,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError('Task save nahi hua. Firestore Rules aur internet check karein.');
    } finally {
      setTaskLoading(false);
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setTitle(task.title || '');
    setDescription(task.description || '');
    setPriority(task.priority || 'Medium');
    setDueDate(task.dueDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleComplete(task) {
  try {
    const isCompleting = !task.completed;

    await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
      completed: isCompleting,
      completedAt: isCompleting ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    setError('Task update nahi hua.');
  }
}
  async function deleteTask(taskId) {
    if (!window.confirm('Kya aap ye task delete karna chahte hain?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskId));
      if (editingId === taskId) resetForm();
    } catch (err) {
      console.error(err);
      setError('Task delete nahi hua.');
    }
  }

  async function clearCompleted() {
    const completedTasks = tasks.filter((task) => task.completed);
    if (!completedTasks.length) {
      setError('Koi completed task nahi hai.');
      return;
    }

    if (!window.confirm('Saare completed tasks delete karein?')) return;

    try {
      await Promise.all(
        completedTasks.map((task) =>
          deleteDoc(doc(db, 'users', user.uid, 'tasks', task.id))
        )
      );
      setError('');
    } catch (err) {
      console.error(err);
      setError('Completed tasks clear nahi hue.');
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      resetForm();
      setError('');
    } catch (err) {
      console.error(err);
      setError('Logout nahi hua. Dobara try karein.');
    }
  }

  if (user === undefined) {
    return <div className="app-loading">TaskFlow load ho raha hai...</div>;
  }

  if (!user) return <Auth />;

  return (
    <main className={`app-shell ${darkMode ? 'dark-mode' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">✓</div>
          <div>
            <h1>TaskFlow</h1>
            <p>Plan your day. Get things done.</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="secondary-btn"
            onClick={() => setDarkMode((value) => !value)}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
          <h2>Welcome back{user.displayName ? `, ${user.displayName}` : ''}!</h2>
          <p>Small steps every day lead to big results.</p>
        </div>
        <div className="date-badge">
          📅 {new Date().toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Close error">×</button>
        </div>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-icon purple">📋</span>
          <p>Total Tasks</p>
          <h3>{tasks.length}</h3>
        </article>
        <article className="stat-card">
          <span className="stat-icon orange">⏳</span>
          <p>Pending</p>
          <h3>{pendingCount}</h3>
        </article>
        <article className="stat-card">
          <span className="stat-icon green">✓</span>
          <p>Completed</p>
          <h3>{completedCount}</h3>
        </article>
        <article className="stat-card">
          <span className="stat-icon blue">📈</span>
          <p>Progress</p>
          <h3>{progress}%</h3>
        </article>
      </section>

      <section className="progress-card">
        <div className="progress-heading">
          <div>
            <h3>Your progress</h3>
            <p>{completedCount} of {tasks.length} tasks completed</p>
          </div>
          <strong>{progress}%</strong>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>
<section className="weekly-chart-card">
  <div className="weekly-chart-heading">
    <div>
      <h3>Weekly Productivity</h3>
      <p>Your completed tasks this week</p>
    </div>
    <span className="weekly-chart-icon">📊</span>
  </div>

  <div className="weekly-chart">
    {weeklyData.map((item) => (
      <div className="chart-column" key={item.day}>
        <span className="chart-count">{item.count}</span>

        <div className="chart-bar-area">
          <div
            className="chart-bar"
            style={{
              height: `${(item.count / maxWeeklyCount) * 100}%`,
            }}
          />
        </div>

        <span className="chart-day">{item.day}</span>
      </div>
    ))}
  </div>
</section>

      <section className="calendar-card">
        <div className="calendar-heading">
          <div><p className="eyebrow">PLAN AHEAD</p><h3>📅 Calendar View</h3><p>Tasks grouped by due date</p></div>
          <div className="calendar-controls"><button className="secondary-btn" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</button><strong>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button className="secondary-btn" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>›</button></div>
        </div>
        <div className="calendar-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
          {Array.from({length: calendarOffset}, (_, i) => <div className="calendar-day blank" key={`blank-${i}`} />)}
          {Array.from({length: monthDays}, (_, i) => { const day = i + 1; const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; const dayTasks = tasksByDate[dateKey] || []; return <div className={`calendar-day ${dateKey === new Date().toISOString().slice(0,10) ? 'today' : ''}`} key={dateKey}><span>{day}</span>{dayTasks.slice(0,2).map(task => <small className={task.completed ? 'calendar-task done' : 'calendar-task'} key={task.id} title={task.title}>{task.title}</small>)}{dayTasks.length > 2 && <small className="calendar-more">+{dayTasks.length-2} more</small>}</div>; })}
        </div>
      </section>

      <section className="reminder-strip"><div><strong>🔔 Task Reminders</strong><p>Allow browser notifications to get a reminder when tasks are due today.</p></div><button className="primary-btn" onClick={enableReminders}>{remindersEnabled ? 'Reminders enabled ✓' : 'Enable reminders'}</button></section>
      <section className="content-grid">
        <div className="panel task-form-panel">
          <div className="panel-heading">
            <div>
              <h3>{editingId ? 'Edit Task' : 'Create a Task'}</h3>
              <p>{editingId ? 'Update your task details' : 'Add something you want to accomplish'}</p>
            </div>
            <span className="heading-icon">✍️</span>
          </div>

          <form onSubmit={handleSubmit} className="task-form">
            <label>
              Task title *
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Complete assignment"
                maxLength={120}
                required
              />
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a few details..."
                rows="3"
              />
            </label>

            <div className="form-row">
              <label>
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>

              <label>
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            </div>

            <button className="primary-btn submit-btn" disabled={taskLoading}>
              {taskLoading ? 'Saving...' : editingId ? 'Update Task' : '+ Add Task'}
            </button>

            {editingId && (
              <button type="button" className="cancel-btn" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </form>
        </div>

        <div className="panel tasks-panel">
          <div className="panel-heading">
            <div>
              <h3>My Tasks</h3>
              <p>Keep your day organized</p>
            </div>
            <span className="task-count">{filteredTasks.length} tasks</span>
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="🔎 Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="filter-row">
            {['All', 'Pending', 'Completed'].map((item) => (
              <button
                key={item}
                className={`filter-btn ${filter === item ? 'active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
            <button className="clear-btn" onClick={clearCompleted}>
              Clear completed
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <span>📝</span>
              <h4>No tasks found</h4>
              <p>Add a new task or change your search/filter.</p>
            </div>
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => {
                const overdue =
                  task.dueDate &&
                  task.dueDate < new Date().toISOString().slice(0, 10) &&
                  !task.completed;

                return (
                  <article
                    className={`task-item ${task.completed ? 'is-completed' : ''}`}
                    key={task.id}
                  >
                    <button
                      className={`complete-toggle ${task.completed ? 'checked' : ''}`}
                      onClick={() => toggleComplete(task)}
                      aria-label={task.completed ? 'Mark pending' : 'Mark completed'}
                    >
                      {task.completed ? '✓' : ''}
                    </button>

                    <div className="task-details">
                      <h4>{task.title}</h4>
                      {task.description && <p>{task.description}</p>}
                      <div className="task-meta">
                        <span className={`priority-badge ${String(task.priority || 'Medium').toLowerCase()}`}>
                          {task.priority || 'Medium'}
                        </span>
                        {task.dueDate && (
                          <span className={overdue ? 'due-date overdue' : 'due-date'}>
                            {overdue ? '⚠ Overdue: ' : '📅 '}
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="task-actions">
                      <button onClick={() => startEdit(task)} title="Edit">✏️</button>
                      <button onClick={() => deleteTask(task.id)} title="Delete">🗑️</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="app-footer">
        Made with care using TaskFlow · Stay focused, stay productive.
      </footer>
    </main>
  );
}

