import Deployment from '../models/Deployment.js';

/**
 * Finds the next available port for deployment starting from 3001.
 * Query MongoDB for the deployment with the highest port allocated so far,
 * then returns that port incremented by 1.
 *
 * @returns {Promise<number>} Next available port
 */
export async function getAvailablePort() {
  const latestDeployment = await Deployment
    .findOne({ port: { $exists: true, $ne: null, $type: 'number' } })
    .sort({ port: -1 })
    .exec();

  if (!latestDeployment || typeof latestDeployment.port !== 'number' || isNaN(latestDeployment.port)) {
    return 3001;
  }

  const nextPort = latestDeployment.port + 1;

  // Standard safe ephemeral/custom port range check
  if (nextPort > 65535) {
    throw new Error('Port range exhausted! No available ports below 65536.');
  }

  return nextPort;
}