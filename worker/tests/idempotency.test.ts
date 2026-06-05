import { describe, it, expect, vi } from 'vitest';
import { enqueueVideoJob } from '../src/queue.js';

vi.mock('bullmq', () => {
  return {
    Queue: class {
      add = vi.fn();
    }
  };
});
vi.mock('ioredis');

describe('Idempotency', () => {
  it('should use processingJobId as jobId for idempotency', async () => {
    const { videoQueue } = await import('../src/queue.js');
    const mockedAdd = vi.mocked(videoQueue.add);

    const idempotencyKey = 'unique-job-id-123';
    
    await enqueueVideoJob(idempotencyKey, { 
      processingJobId: idempotencyKey, 
      kind: 'generate_proxy' 
    });

    expect(mockedAdd).toHaveBeenCalledWith(
      'generate_proxy',
      expect.any(Object),
      expect.objectContaining({
        jobId: idempotencyKey // This is what BullMQ uses to ensure idempotency
      })
    );
  });
});
