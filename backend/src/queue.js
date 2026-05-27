import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// The queue — API server adds jobs here, worker consumes them
export const deployQueue = new Queue('deployments', { connection });

console.log('[Queue] BullMQ connected to Redis');
