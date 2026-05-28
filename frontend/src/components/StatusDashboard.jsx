import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const POLL_INTERVAL = 3000;

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function LogLine({ line }) {
  // Parse "[2026-...Z] message" format
  const match = line.match(/^\[([^\]]+)\]\s(.+)$/);
  if (match) {
    return (
      <span className="log-line">
        <span className="timestamp">[{match[1]}]</span>{' '}
        <span className="log-msg">{match[2]}</span>
        {'\n'}
      </span>
    );
  }
  return <span className="log-line"><span className="log-msg">{line}</span>{'\n'}</span>;
}

function DeploymentCard({ deployment, onUpdate }) {
  const [data, setData] = useState(deployment);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    setData(deployment);
  }, [deployment]);

  useEffect(() => {
    // Stop polling once terminal state is reached
    if (data.status === 'completed' || data.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const { data: updated } = await axios.get(
          `${API}/api/status/${data.deploymentId || data._id}`
        );
        const merged = { ...updated, deploymentId: updated.deploymentId || updated._id };
        setData(merged);
        if (onUpdate) onUpdate(merged);
      } catch (err) {
        console.error('Polling error:', err.message);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [data.status, data.deploymentId]);

  const statusIcon = {
    pending: '🕐',
    processing: null, // spinner
    completed: '✅',
    failed: '❌',
  };

  return (
    <div className={`deployment-card status-${data.status}`} id={`card-${data.deploymentId || data._id}`}>
      <div className="card-header">
        <div>
          <div className="card-client">{data.clientName}</div>
          <div className="card-domain">🌐 {data.domain}</div>
        </div>

        <span className={`status-badge ${data.status}`}>
          {data.status === 'processing' ? (
            <span className="processing-spin" />
          ) : (
            statusIcon[data.status]
          )}
          {data.status === 'processing' ? 'Processing' : data.status}
        </span>
      </div>

      <div className="card-image">
        <span>Image:</span>
        <span className="image-tag">{data.image}</span>
        {data.port && (
          <>
            <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
            <span>Port:</span>
            <span className="port-tag">{data.port}</span>
          </>
        )}
      </div>

      {data.updatedAt && (
        <div className="card-meta">
          🕐 Last updated: {formatTimestamp(data.updatedAt)}
          {(data.status === 'pending' || data.status === 'processing') && (
            <span style={{ marginLeft: 8, color: 'var(--status-processing-text)' }}>
              · polling every {POLL_INTERVAL / 1000}s
            </span>
          )}
        </div>
      )}

      {(data.status === 'completed' || (data.logs && data.logs.length > 0)) && (
        <div className="card-actions">
          {data.status === 'completed' && (
            <a
              href={`http://${data.domain}`}
              target="_blank"
              rel="noreferrer"
              className="btn-open-app"
              id={`open-app-${data.deploymentId || data._id}`}
            >
              🌐 Open App
            </a>
          )}

          {data.logs && data.logs.length > 0 && (
            <button
              className="logs-toggle"
              onClick={() => setShowLogs((v) => !v)}
              id={`logs-toggle-${data.deploymentId || data._id}`}
            >
              {showLogs ? '▲' : '▼'} Logs ({data.logs.length})
            </button>
          )}
        </div>
      )}

      {showLogs && data.logs && data.logs.length > 0 && (
        <pre className="logs-panel">
          {data.logs.map((line, i) => (
            <LogLine key={i} line={line} />
          ))}
        </pre>
      )}
    </div>
  );
}

export default function StatusDashboard({ deployments, setDeployments }) {
  function handleUpdate(updated) {
    setDeployments((prev) =>
      prev.map((d) =>
        (d.deploymentId || d._id) === (updated.deploymentId || updated._id) ? updated : d
      )
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <p className="section-title" style={{ margin: 0, flex: 1 }}>
          Live Deployments
        </p>
        {deployments.length > 0 && (
          <span className="dashboard-count">{deployments.length} total</span>
        )}
      </div>

      {deployments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>No deployments yet. Submit the form above to get started.</p>
        </div>
      ) : (
        deployments.map((d) => (
          <DeploymentCard
            key={d.deploymentId || d._id}
            deployment={d}
            onUpdate={handleUpdate}
          />
        ))
      )}
    </div>
  );
}
