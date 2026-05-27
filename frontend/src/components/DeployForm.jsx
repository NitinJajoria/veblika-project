import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function DeployForm({ onDeployed }) {
  const [form, setForm] = useState({
    clientName: '',
    domain: '',
    image: 'nginx:latest',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/api/deploy`, form);
      onDeployed({
        deploymentId: data.deploymentId,
        ...form,
        port: data.port,
        status: 'pending',
        logs: [],
      });
      setForm({ clientName: '', domain: '', image: 'nginx:latest' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to queue deployment. Is the API running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="deploy-form-card">
      <form onSubmit={handleSubmit} id="deploy-form">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="clientName">Client Name</label>
            <input
              id="clientName"
              name="clientName"
              className="form-input"
              value={form.clientName}
              onChange={handleChange}
              placeholder="acme-corp"
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="domain">Domain</label>
            <input
              id="domain"
              name="domain"
              className="form-input"
              value={form.domain}
              onChange={handleChange}
              placeholder="acme.ourplatform.com"
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="image">Docker Image</label>
            <input
              id="image"
              name="image"
              className="form-input"
              value={form.image}
              onChange={handleChange}
              placeholder="nginx:latest"
              required
              autoComplete="off"
            />
          </div>
        </div>

        <div className="form-footer">
          {error ? (
            <span className="form-error">⚠ {error}</span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Job queued async — status updates every 3s
            </span>
          )}

          <button
            id="btn-deploy"
            type="submit"
            className="btn-deploy"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Queueing…
              </>
            ) : (
              <>🚢 Deploy</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
