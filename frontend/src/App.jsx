import { useState, useEffect } from 'react';
import DeployForm from './components/DeployForm';
import StatusDashboard from './components/StatusDashboard';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [deployments, setDeployments] = useState([]);

  // Load existing deployments on mount
  useEffect(() => {
    axios
      .get(`${API}/api/deployments`)
      .then(({ data }) => setDeployments(data.map((d) => ({ ...d, deploymentId: d._id }))))
      .catch(() => {});
  }, []);

  function addDeployment(deployment) {
    setDeployments((prev) => [deployment, ...prev]);
  }

  return (
    <div className="app-wrapper">
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-icon">🚀</div>
          <div className="header-text">
            <h1>Hosting Control Panel</h1>
            <p>Deploy Docker containers via BullMQ + AWS SSM + Lambda</p>
          </div>
          <div className="header-badge">
            <span className="pulse-dot" />
            Live
          </div>
        </header>

        {/* Deploy Form */}
        <p className="section-title">New Deployment</p>
        <DeployForm onDeployed={addDeployment} />

        {/* Status Dashboard */}
        <StatusDashboard deployments={deployments} setDeployments={setDeployments} />
      </div>
    </div>
  );
}
