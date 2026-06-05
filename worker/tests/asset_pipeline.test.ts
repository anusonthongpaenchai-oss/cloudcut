import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractMetadata } from '../src/asset_pipeline.js';
import * as ffmpeg from '../src/ffmpeg.js';
import * as storage from '../src/storage.js';
import * as queue from '../src/queue.js';

// Mock dependencies
vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    asset: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { PrismaClient: class { constructor() { return mPrismaClient; } } };
});
vi.mock('../src/ffmpeg.js');
vi.mock('../src/storage.js');
vi.mock('../src/queue.js');
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient() as any;

describe('Asset Pipeline - ExtractMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse ffprobe output and enqueue 3 parallel jobs', async () => {
    const jobId = 'test-job-123';
    const assetId = 'asset-123';

    // Mock asset find
    prisma.asset.findUnique.mockResolvedValue({
      id: assetId,
      original_url: 'http://example.com/video.mp4',
    });

    // Mock download
    vi.mocked(storage.downloadToTemp).mockResolvedValue(undefined);

    // Mock ffprobe output
    const mockFfprobeData = {
      format: {
        duration: "10.5",
        size: "1024000"
      },
      streams: [
        { codec_type: "video", width: 1920, height: 1080, codec_name: "h264" },
        { codec_type: "audio", codec_name: "aac", channels: 2 }
      ]
    };
    vi.mocked(ffmpeg.runFfmpegCommand).mockResolvedValue(JSON.stringify(mockFfprobeData));

    // Execute
    await extractMetadata(jobId, assetId);

    // Verify Asset Metadata Update
    expect(prisma.asset.update).toHaveBeenCalledWith({
      where: { id: assetId },
      data: {
        status: 'ready',
        metadata: {
          duration_ms: 10500,
          width: 1920,
          height: 1080,
          codec: 'h264',
          audio_codec: 'aac',
          audio_channels: 2,
          file_size_bytes: 1024000,
        }
      }
    });

    // Verify 3 parallel jobs were enqueued
    expect(queue.enqueueVideoJob).toHaveBeenCalledTimes(3);
    expect(queue.enqueueVideoJob).toHaveBeenCalledWith(`${jobId}-proxy`, expect.objectContaining({ kind: 'generate_proxy' }));
    expect(queue.enqueueVideoJob).toHaveBeenCalledWith(`${jobId}-thumb`, expect.objectContaining({ kind: 'generate_thumbnails' }));
    expect(queue.enqueueVideoJob).toHaveBeenCalledWith(`${jobId}-wave`, expect.objectContaining({ kind: 'extract_waveform' }));
  });
});
