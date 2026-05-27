import express from 'express';
import Deployment from '../models/Deployment.js';
import { deployQueue } from '../queue.js';

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

    // Save to MongoDB as pending
    const deployment = await Deployment.create({
      clientName,
      domain,
      image,
      status: 'pending',
    });

    // Push job to BullMQ queue (non-blocking)
    await deployQueue.add('deploy-container', {
      deploymentId: deployment._id.toString(),
      clientName,
      domain,
      image,
    });

    console.log(`[API] Queued deployment for ${clientName} (${domain})`);

    return res.status(200).json({
      message: 'Deployment queued',
      deploymentId: deployment._id,
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
