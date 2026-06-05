import { describe, it, expect, vi } from 'vitest';
import { enqueueVideoJob } from '../src/queue.js';
import { Queue } from 'bullmq';

vi.mock('bullmq', () => {
  return {
    Queue: class {
      add = vi.fn();
    }
  };
});
vi.mock('ioredis');

describe('Retry Logic', () => {
  it('should enqueue job with exactly 3 retries and exponential backoff', async () => {
    // get the mocked queue instance
    const { videoQueue } = await import('../src/queue.js');
    const mockedAdd = vi.mocked(videoQueue.add);

    await enqueueVideoJob('job-1', { processingJobId: 'job-1', kind: 'extract_metadata' });

    expect(mockedAdd).toHaveBeenCalledWith(
      'extract_metadata',
      expect.any(Object),
      expect.objectContaining({
        attempts: 4, // 1 initial + 3 retries
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      })
    );
  });
});
