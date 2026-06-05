import { startWorkers } from './processor.js';
import { cronQueue } from './queue.js';

async function main() {
  console.log('Starting CloudCut Worker Node...');

  // Start the BullMQ workers
  const { videoWorker, cronWorker } = startWorkers();

  // Schedule the daily cleanup job (runs every day at midnight)
  await cronQueue.add('cleanup', {}, {
    repeat: {
      pattern: '0 0 * * *'
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing workers...`);
    await videoWorker.close();
    await cronWorker.close();
    console.log('Workers closed successfully.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal error during startup', err);
  process.exit(1);
});
