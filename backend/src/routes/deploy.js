import express from 'express';
import Deployment from '../models/Deployment.js';
import { deployQueue } from '../queue.js';
import { getAvailablePort } from '../utils/getAvailablePort.js';

const router = express.Router();

// POST /api/deploy
// Accepts form data, saves to MongoDB as "pending",
// pushes to BullMQ queue, returns 200 OK immediately
router.post('/deploy', async (req, res) => {
  try {
    const { clientName, domain, image } = req.body;

    if (!clientName || !domain || !image) {
      return res.status(400).json({ error: 'clientName, domain and image are required' });
    }

    let deployment;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const port = await getAvailablePort();

        // 1. Double check port bounds
        if (port < 3001 || port > 65535) {
          throw new Error(`Allocated port ${port} is out of safe user bounds (3001-65535).`);
        }

        // 2. Mark previous deployments for the same client as superseded in logs
        await Deployment.updateMany(
          { clientName, status: { $in: ['pending', 'processing', 'completed'] } },
          { $push: { logs: `[${new Date().toISOString()}] Superseded by a new deployment on port ${port}.` } }
        );

        // 3. Try to save to MongoDB with the allocated port
        deployment = await Deployment.create({
          clientName,
          domain,
          image,
          port,
          status: 'pending',
          logs: [`[${new Date().toISOString()}] Deployment initialized on allocated port ${port}.`],
        });

        // Break if creation succeeded
        break;
      } catch (err) {
        // If MongoDB unique constraint on port is violated (code 11000)
        if (err.code === 11000 && err.keyPattern && err.keyPattern.port) {
          attempts++;
          console.warn(`[API] Port conflict detected on database insert. Retrying allocation attempt ${attempts}/${maxAttempts}...`);
          continue;
        }
        // Rethrow other errors immediately
        throw err;
      }
    }

    if (!deployment) {
      return res.status(500).json({
        error: 'Failed to allocate an available unique port after multiple attempts. Please try again.',
      });
    }

    // 4. Push job to BullMQ queue with the allocated port (non-blocking)
    await deployQueue.add('deploy-container', {
      deploymentId: deployment._id.toString(),
      clientName,
      domain,
      image,
      port: deployment.port,
    });

    console.log(`[API] Queued deployment for ${clientName} (${domain}) on port ${deployment.port}`);

    return res.status(200).json({
      message: 'Deployment queued',
      deploymentId: deployment._id,
      port: deployment.port,
    });
  } catch (err) {
    console.error('[API] Error queuing deployment:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/status/:id
// Returns current deployment status from MongoDB
router.get('/status/:id', async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id).lean();

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    return res.json({
      deploymentId: deployment._id,
      clientName: deployment.clientName,
      domain: deployment.domain,
      image: deployment.image,
      status: deployment.status,
      logs: deployment.logs || [],
      updatedAt: deployment.updatedAt,
    });
  } catch (err) {
    console.error('[API] Error fetching status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deployments
// Returns all deployments (for the full status dashboard on load)
router.get('/deployments', async (req, res) => {
  try {
    const deployments = await Deployment.find().sort({ createdAt: -1 }).lean();
    return res.json(deployments);
  } catch (err) {
    console.error('[API] Error fetching deployments:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
