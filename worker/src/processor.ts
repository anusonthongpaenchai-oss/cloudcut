import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { connection, VideoJobPayload } from './queue.js';
import { 
  extractMetadata, 
  generateProxy, 
  generateThumbnails, 
  extractWaveform 
} from './asset_pipeline.js';
import { renderExport } from './export_pipeline.js';
import { runDailyCleanup } from './cleanup.js';

const prisma = new PrismaClient();

async function handleVideoJob(job: Job<VideoJobPayload>) {
  const { kind, processingJobId, assetId, exportJobId } = job.data;
  
  // Mark processing job as processing
  try {
    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: { status: 'processing', attempts: job.attemptsMade + 1 }
    });
  } catch (error) {
    // If job doesn't exist, ignore
    console.warn(`ProcessingJob ${processingJobId} not found in DB`);
  }

  try {
    switch (kind) {
      case 'extract_metadata':
        if (!assetId) throw new Error('Missing assetId');
        await extractMetadata(job.id!, assetId);
        break;
      case 'generate_proxy':
        if (!assetId) throw new Error('Missing assetId');
        await generateProxy(job.id!, assetId);
        break;
      case 'generate_thumbnails':
        if (!assetId) throw new Error('Missing assetId');
        await generateThumbnails(job.id!, assetId);
        break;
      case 'extract_waveform':
        if (!assetId) throw new Error('Missing assetId');
        await extractWaveform(job.id!, assetId);
        break;
      case 'render_export':
        if (!exportJobId) throw new Error('Missing exportJobId');
        await renderExport(job.id!, exportJobId);
        break;
      default:
        throw new Error(`Unknown job kind: ${kind}`);
    }

    // Mark as completed
    try {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'completed' }
      });
    } catch (e) { /* ignore if not found */ }
    
  } catch (error) {
    // Check if it's the final attempt
    const maxAttempts = job.opts.attempts || 1;
    const isDeadLetter = job.attemptsMade >= maxAttempts;
    
    try {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { 
          status: isDeadLetter ? 'dead_letter' : 'failed',
          error_message: (error as Error).message
        }
      });
    } catch (e) { /* ignore if not found */ }
    
    throw error; // Re-throw so BullMQ knows it failed
  }
}

export function startWorkers() {
  const videoWorker = new Worker<VideoJobPayload>('video-jobs', handleVideoJob, { 
    connection,
    concurrency: 5 // Process 5 jobs in parallel
  });

  videoWorker.on('completed', (job) => {
    console.log(`Job ${job.id} of kind ${job.data.kind} has completed!`);
  });

  videoWorker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
  });

  const cronWorker = new Worker('cron-jobs', async (job) => {
    if (job.name === 'cleanup') {
      await runDailyCleanup();
    }
  }, { connection });

  console.log('Workers started successfully.');

  return { videoWorker, cronWorker };
}
