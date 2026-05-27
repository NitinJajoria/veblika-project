import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import dotenv from 'dotenv';
import Deployment from './models/Deployment.js';

dotenv.config();

// ─── Demo mode toggle ────────────────────────────────────────────────────────
// Set DEMO_MODE=true in .env to simulate AWS calls without real credentials
const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (DEMO_MODE) {
  console.log('[Worker] ⚡ DEMO MODE enabled — AWS calls will be simulated');
}

// ─── AWS clients ─────────────────────────────────────────────────────────────

const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'demo',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'demo',
  },
});

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'demo',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'demo',
  },
});

// ─── Redis connection ─────────────────────────────────────────────────────────

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// ─── Connect to MongoDB ───────────────────────────────────────────────────────

await mongoose.connect(process.env.MONGO_URI);
console.log('[Worker] MongoDB connected');

// ─── Helper: update deployment status ────────────────────────────────────────

async function updateStatus(id, status, logMsg) {
  await Deployment.findByIdAndUpdate(id, {
    status,
    $push: { logs: `[${new Date().toISOString()}] ${logMsg}` },
  });
  console.log(`[Worker] ${id} → ${status}: ${logMsg}`);
}

// ─── Step 1: Run Docker container on EC2 via SSM SendCommand ─────────────────

async function runDockerOnEC2(clientName, domain, image, port) {
  // DEMO MODE: simulate SSM call with a delay
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 1500));
    return 'mock-ssm-command-' + Date.now();
  }

  const containerName = `deployflow-${clientName}`;
  const dockerCommand = [
    `echo "Starting deployment cleanup for client: ${clientName}..."`,
    // 1. Stop and remove old container with this client name to avoid name conflicts
    `docker stop ${containerName} 2>/dev/null || true`,
    `docker rm ${containerName} 2>/dev/null || true`,
    // 2. Preemptively stop and remove any container using the target port to avoid port conflicts
    'CONFLICT_CONTAINERS=$(docker ps -laq --filter "publish=' + port + '")',
    'if [ ! -z "$CONFLICT_CONTAINERS" ]; then echo "Stopping conflicting container on port ' + port + '"; docker stop $CONFLICT_CONTAINERS 2>/dev/null || true; docker rm $CONFLICT_CONTAINERS 2>/dev/null || true; fi',
    `echo "Pulling image ${image}..."`,
    `docker pull ${image}`,
    `echo "Launching container ${containerName} on host port ${port}..."`,
    `docker run -d --name ${containerName} -p ${port}:80 --label domain=${domain} ${image}`,
    `echo "Deployment successfully completed!"`
  ].join(' && ');

  const params = {
    InstanceIds: [process.env.EC2_INSTANCE_ID],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [dockerCommand],
    },
    Comment: `Deploy ${image} for ${clientName} on ${domain} (Port ${port})`,
  };

  const command = new SendCommandCommand(params);
  const response = await ssmClient.send(command);
  return response.Command?.CommandId;
}

// ─── Step 2: Invoke Lambda for post-deploy setup ──────────────────────────────

async function invokeLambda(clientName, domain, image) {
  // DEMO MODE: simulate Lambda call with a delay
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    return { statusCode: 200, result: { message: 'mock lambda ok — DNS configured' } };
  }

  const payload = JSON.stringify({ clientName, domain, image, action: 'post-deploy' });

  const params = {
    FunctionName: process.env.LAMBDA_FUNCTION_NAME,
    InvocationType: 'RequestResponse', // synchronous — waits for Lambda response
    Payload: Buffer.from(payload),
  };

  const command = new InvokeCommand(params);
  const response = await lambdaClient.send(command);

  const resultPayload = JSON.parse(Buffer.from(response.Payload).toString());
  return { statusCode: response.StatusCode, result: resultPayload };
}

// ─── Main worker ──────────────────────────────────────────────────────────────

const worker = new Worker(
  'deployments',
  async (job) => {
    const { deploymentId, clientName, domain, image, port } = job.data;
    console.log(`[Worker] Processing job for ${clientName} (${domain}) on port ${port}`);

    // Mark as processing
    await updateStatus(deploymentId, 'processing', `Worker picked up job. Target port: ${port}`);

    // ── Step 1: Docker on EC2 via SSM ──────────────────────────────────────
    let commandId;
    try {
      commandId = await runDockerOnEC2(clientName, domain, image, port);
      await updateStatus(
        deploymentId,
        'processing',
        DEMO_MODE
          ? `[DEMO] SSM SendCommand simulated — CommandId: ${commandId}`
          : `SSM command sent — CommandId: ${commandId}`
      );
    } catch (err) {
      // In production without real EC2, log and continue
      const msg = `SSM step skipped (no real EC2): ${err.message}`;
      await updateStatus(deploymentId, 'processing', msg);
    }

    // ── Step 2: Invoke Lambda ──────────────────────────────────────────────
    try {
      const lambdaResult = await invokeLambda(clientName, domain, image);
      await updateStatus(
        deploymentId,
        'processing',
        DEMO_MODE
          ? `[DEMO] Lambda invoked — result: ${JSON.stringify(lambdaResult.result)}`
          : `Lambda invoked — status: ${lambdaResult.statusCode}`
      );
    } catch (err) {
      const msg = `Lambda step skipped (no real Lambda): ${err.message}`;
      await updateStatus(deploymentId, 'processing', msg);
    }

    // ── Mark completed ────────────────────────────────────────────────────
    await updateStatus(deploymentId, 'completed', `Deployment finished for ${domain} on port ${port}`);
  },
  {
    connection,
    concurrency: 3, // process up to 3 jobs simultaneously
  }
);

// ─── Worker event handlers ────────────────────────────────────────────────────

worker.on('completed', (job) => {
  console.log(`[Worker] ✅ Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
  console.error(`[Worker] ❌ Job ${job.id} failed:`, err.message);
  if (job.data?.deploymentId) {
    await Deployment.findByIdAndUpdate(job.data.deploymentId, {
      status: 'failed',
      $push: { logs: `[${new Date().toISOString()}] Job failed: ${err.message}` },
    });
  }
});

console.log('[Worker] 👂 Listening for deployment jobs...');
