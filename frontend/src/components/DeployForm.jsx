```jsx
import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Your EC2 public IP
const SERVER_IP = '13.126.251.80';

export default function DeployForm({ onDeployed }) {
  const [form, setForm] = useState({
    clientName: '',
    domain: '',
    image: 'nginx:latest',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;

    // Auto-generate domain when client name changes
    if (name === 'clientName') {
      const sanitized = value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      setForm((prev) => ({
        ...prev,
        clientName: value,
        domain: sanitized
          ? `${ sanitized }.${ SERVER_IP }.sslip.io`
          : '',
      }));

      return;
    }

    // Allow manual domain editing
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const { data } = await axios.post(`${ API } /api/deploy`, form);

      onDeployed({
        deploymentId: data.deploymentId,
        ...form,
        port: data.port,
        status: 'pending',
        logs: [],
      });

      setForm({
        clientName: '',
        domain: '',
        image: 'nginx:latest',
      });

    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Failed to queue deployment. Is the API running?'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="deploy-form-card">
      <form onSubmit={handleSubmit} id="deploy-form">

        <div className="form-grid">

          {/* CLIENT NAME */}
          <div className="form-group">
            <label className="form-label" htmlFor="clientName">
              Client Name
            </label>

            <input
              id="clientName"
              name="clientName"
              className="form-input"
              value={form.clientName}
              onChange={handleChange}
              placeholder="awesome"
              required
              autoComplete="off"
            />
          </div>

          {/* DOMAIN */}
          <div className="form-group">
            <label className="form-label">

              Domain

              <span
                title="Domains use sslip.io wildcard DNS. Entering awesome.13.126.251.80.sslip.io automatically points traffic to this EC2 server without buying a real domain."
                style={{
                  marginLeft: '8px',
                  cursor: 'help',
                  color: '#8b5cf6',
                  fontWeight: 'bold',
                  border: '1px solid #8b5cf6',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                }}
              >
                ?
              </span>

            </label>

            <input
              type="text"
              name="domain"
              className="form-input"
              value={form.domain}
              onChange={handleChange}
              placeholder={`awesome.${ SERVER_IP }.sslip.io`}
              required
              autoComplete="off"
            />

          </div>

          {/* DOCKER IMAGE */}
          <div className="form-group">
            <label className="form-label" htmlFor="image">
              Docker Image
            </label>

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

        {/* FOOTER */}
        <div className="form-footer">

          {error ? (
            <span className="form-error">
              ⚠ {error}
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
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
```
