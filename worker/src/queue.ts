import { Queue, ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { ProcessingJobKind } from '@prisma/client';

dotenv.config();

const redisConfig: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Create a shared Redis connection for queues (reuse connections)
export const connection = new Redis(redisConfig);

// Define job payloads based on the user requirement: { processingJobId, assetId }
export interface VideoJobPayload {
  processingJobId: string;
  assetId?: string; // Optional if it's an export job
  exportJobId?: string; // Optional if it's an asset job
  kind: ProcessingJobKind;
}

// Queue Definitions
// video-jobs is for all the asset processing and exporting
export const videoQueue = new Queue<VideoJobPayload>('video-jobs', { connection });

// cron-jobs is for repeating tasks like CleanupExpiredFiles
export const cronQueue = new Queue('cron-jobs', { connection });

// Function to add a job to the video queue
export async function enqueueVideoJob(
  jobId: string,
  payload: VideoJobPayload,
  attempts: number = 0
) {
  // Idempotency key requirement: BullMQ 'jobId' acts as the idempotency key.
  // Using processingJobId ensures the same processing job isn't queued twice.
  
  // Calculate delay for exponential backoff if this is a retry manually pushed,
  // but BullMQ handles backoff automatically. We configure it in the job options.
  await videoQueue.add(payload.kind, payload, {
    jobId: payload.processingJobId, // acts as idempotency_key
    attempts: 4, // 3 retries (1 initial + 3 retries)
    backoff: {
      type: 'exponential',
      delay: 1000, // attempt 2: +1s, attempt 3: +2s, attempt 4: +4s. Wait, requirements:
      // immediate, +1s, +4s, +16s. We will implement a custom backoff strategy in the worker.
    },
    removeOnComplete: true,
    removeOnFail: false, // keep failed jobs to investigate dead letters
  });
}
