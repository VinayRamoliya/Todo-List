import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function priorityClass(p) {
  if (p === 'high') return 'badge high';
  if (p === 'low') return 'badge low';
  return 'badge medium';
}

function categoryClass(c) {
  if (c === 'personal') return 'badge personal';
  if (c === 'study') return 'badge study';
  return 'badge work';
}

function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isOverdue(task) {
  if (task.status === 'completed' || !task.deadline) return false;
  const now = new Date();
  const deadlineDate = new Date(task.deadline);
  return deadlineDate.getTime() < now.getTime();
}

const DEFAULT_TASK_SUMMARY = {
  total: 0,
  pending: 0,
  completed: 0,
  overdue: 0,
  categories: { work: 0, personal: 0, study: 0 },
};

function normalizeSummary(data) {
  if (!data || typeof data !== 'object') return { ...DEFAULT_TASK_SUMMARY };
  return {
    ...DEFAULT_TASK_SUMMARY,
    ...data,
    categories: {
      ...DEFAULT_TASK_SUMMARY.categories,
      ...(data.categories && typeof data.categories === 'object' ? data.categories : {}),
    },
  };
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'work',
    deadline: '',
  });
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'work',
    deadline: '',
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all',
  });
  const [summary, setSummary] = useState(DEFAULT_TASK_SUMMARY);

  const refreshSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/tasks/summary');
      setSummary(normalizeSummary(data));
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Could not refresh overview.');
    }
  }, [logout, navigate]);

  const loadTasks = useCallback(async () => {
    setError('');
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.category !== 'all') params.category = filters.category;
      const [tasksRes, summaryRes] = await Promise.all([
        api.get('/tasks', { params }),
        api.get('/tasks/summary'),
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setSummary(normalizeSummary(summaryRes.data));
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, [filters, logout, navigate]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/tasks', {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category,
        deadline: form.deadline || null,
        status: 'pending',
      });
      setTasks((prev) => [data, ...prev]);
      setForm({ title: '', description: '', priority: 'medium', category: 'work', deadline: '' });
      await refreshSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add task.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(task) {
    setEditingTaskId(task._id);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      category: task.category || 'work',
      deadline: toInputDate(task.deadline),
    });
    setError('');
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditForm({
      title: '',
      description: '',
      priority: 'medium',
      category: 'work',
      deadline: '',
    });
  }

  async function saveEdit(id) {
    if (!editForm.title.trim()) {
      setError('Title is required.');
      return;
    }
    try {
      const { data } = await api.patch(`/tasks/${id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority,
        category: editForm.category,
        deadline: editForm.deadline || null,
      });
      setTasks((prev) => prev.map((t) => (t._id === id ? data : t)));
      cancelEdit();
      await refreshSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not edit task.');
    }
  }

  async function handleComplete(id) {
    try {
      const { data } = await api.patch(`/tasks/${id}`, { status: 'completed' });
      setTasks((prev) => prev.map((t) => (t._id === id ? data : t)));
      await refreshSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update task.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      await refreshSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete task.');
    }
  }

  async function handleClearCompleted() {
    try {
      await api.delete('/tasks/completed');
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not clear completed tasks.');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <p className="eyebrow">Taskboard</p>
          <h1>Hello{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="muted small">Signed in as {user?.email}</p>
        </div>
        <button type="button" className="btn ghost" onClick={handleLogout}>
          Sign out
        </button>
      </header>

      <section className="panel">
        <h2>Add a task</h2>
        <form onSubmit={handleAdd} className="task-form">
          <div className="task-form-row">
            <label className="field grow">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="What needs to be done?"
                required
              />
            </label>
            <label className="field narrow">
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="field narrow">
              <span>Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="study">Study</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional details, links, or notes"
            />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </label>
          <div className="task-form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Overview</h2>
          <button
            type="button"
            className="btn small ghost"
            onClick={handleClearCompleted}
            disabled={summary.completed === 0}
          >
            Clear completed
          </button>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <p className="muted small">Total</p>
            <h3>{summary.total}</h3>
          </div>
          <div className="stat-card">
            <p className="muted small">Pending</p>
            <h3>{summary.pending}</h3>
          </div>
          <div className="stat-card">
            <p className="muted small">Completed</p>
            <h3>{summary.completed}</h3>
          </div>
          <div className="stat-card">
            <p className="muted small">Overdue</p>
            <h3>{summary.overdue}</h3>
          </div>
        </div>
        <p className="task-meta muted small">
          Work: {summary.categories?.work || 0} · Personal: {summary.categories?.personal || 0} · Study:{' '}
          {summary.categories?.study || 0}
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Your tasks</h2>
          {!loading ? <span className="muted small">{tasks.length} total</span> : null}
        </div>
        <div className="task-form-row filters-row">
          <label className="field grow">
            <span>Search</span>
            <input
              placeholder="Search by title or description"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </label>
          <label className="field narrow">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field narrow">
            <span>Category</span>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="study">Study</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p className="muted">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="empty muted">No tasks yet. Add one above to get started.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((t) => (
              <li
                key={t._id}
                className={[
                  'task-card',
                  t.status === 'completed' ? 'done' : '',
                  isOverdue(t) ? 'overdue' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="task-main">
                  {editingTaskId === t._id ? (
                    <div className="stack">
                      <label className="field">
                        <span>Title</span>
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <textarea
                          rows={2}
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        />
                      </label>
                      <div className="task-form-row">
                        <label className="field narrow">
                          <span>Priority</span>
                          <select
                            value={editForm.priority}
                            onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </label>
                        <label className="field narrow">
                          <span>Category</span>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                          >
                            <option value="work">Work</option>
                            <option value="personal">Personal</option>
                            <option value="study">Study</option>
                          </select>
                        </label>
                        <label className="field narrow">
                          <span>Deadline</span>
                          <input
                            type="date"
                            value={editForm.deadline}
                            onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="task-title-row">
                        <h3>{t.title}</h3>
                        <span className={priorityClass(t.priority)}>{t.priority}</span>
                        <span className={categoryClass(t.category)}>{t.category || 'work'}</span>
                        {isOverdue(t) ? <span className="badge overdue">Overdue</span> : null}
                      </div>
                      {t.description ? <p className="task-desc">{t.description}</p> : null}
                      <p className="task-meta muted small">
                        {t.status === 'completed' ? 'Completed' : 'Pending'}
                        {t.deadline ? ` · Due ${new Date(t.deadline).toLocaleDateString()}` : ''}
                        {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleString()}` : ''}
                      </p>
                    </>
                  )}
                </div>
                <div className="task-actions">
                  {editingTaskId === t._id ? (
                    <>
                      <button type="button" className="btn small primary" onClick={() => saveEdit(t._id)}>
                        Save
                      </button>
                      <button type="button" className="btn small ghost" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {t.status !== 'completed' ? (
                        <button
                          type="button"
                          className="btn small secondary"
                          onClick={() => handleComplete(t._id)}
                        >
                          Mark done
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => startEdit(t)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => handleDelete(t._id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
