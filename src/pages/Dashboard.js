import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function priorityClass(p) {
  if (p === 'high') return 'badge high';
  if (p === 'low') return 'badge low';
  return 'badge medium';
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
  });
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/tasks');
      setTasks(Array.isArray(data) ? data : []);
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
  }, [logout, navigate]);

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
        status: 'pending',
      });
      setTasks((prev) => [data, ...prev]);
      setForm({ title: '', description: '', priority: 'medium' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add task.');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(id) {
    try {
      const { data } = await api.patch(`/tasks/${id}`, { status: 'completed' });
      setTasks((prev) => prev.map((t) => (t._id === id ? data : t)));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update task.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete task.');
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
          <h2>Your tasks</h2>
          {!loading ? <span className="muted small">{tasks.length} total</span> : null}
        </div>
        {loading ? (
          <p className="muted">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="empty muted">No tasks yet. Add one above to get started.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((t) => (
              <li key={t._id} className={t.status === 'completed' ? 'task-card done' : 'task-card'}>
                <div className="task-main">
                  <div className="task-title-row">
                    <h3>{t.title}</h3>
                    <span className={priorityClass(t.priority)}>{t.priority}</span>
                  </div>
                  {t.description ? <p className="task-desc">{t.description}</p> : null}
                  <p className="task-meta muted small">
                    {t.status === 'completed' ? 'Completed' : 'Pending'}
                    {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="task-actions">
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
                    className="btn small danger"
                    onClick={() => handleDelete(t._id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
