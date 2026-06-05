import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderExport } from '../src/export_pipeline.js';
import * as ffmpeg from '../src/ffmpeg.js';
import * as storage from '../src/storage.js';
import * as progress from '../src/progress.js';
import { ClipEffectType } from '@prisma/client';

vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    exportJob: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    track: {
      findMany: vi.fn(),
    },
    clip: {
      findMany: vi.fn(),
    }
  };
  return { PrismaClient: class { constructor() { return mPrismaClient; } }, ClipEffectType: { brightness: 'brightness' } };
});

vi.mock('../src/ffmpeg.js');
vi.mock('../src/storage.js');
vi.mock('../src/progress.js');
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn().mockResolvedValue({ size: 2048000 })
}));

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient() as any;

describe('Export Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate ffmpeg commands, update progress, and complete export', async () => {
    const jobId = 'test-job';
    const exportJobId = 'export-123';

    // Mocks
    prisma.exportJob.findUnique.mockResolvedValue({
      id: exportJobId,
      project_id: 'proj-123',
      request_by: 'user-123',
      status: 'queued'
    });
    
    prisma.track.findMany.mockResolvedValue([{ id: 'track-1', type: 'video' }]);
    prisma.clip.findMany.mockResolvedValue([
      {
        id: 'clip-1',
        asset: { original_url: 'http://example.com/c1.mp4' },
        in_point_ms: 0,
        out_point_ms: 5000,
        effects: []
      },
      {
        id: 'clip-2',
        asset: { original_url: 'http://example.com/c2.mp4' },
        in_point_ms: 2000,
        out_point_ms: 8000,
        effects: [{ type: 'brightness', params: { value: 0.1 }, enabled: true }]
      }
    ]);

    vi.mocked(storage.uploadToS3).mockResolvedValue('http://minio/exports/proj-123/export-123.mp4');
    vi.mocked(ffmpeg.runFfmpegCommand).mockResolvedValue('');

    await renderExport(jobId, exportJobId);

    // Verify ffmpeg called for each clip and then concat
    expect(ffmpeg.runFfmpegCommand).toHaveBeenCalledTimes(3); // 2 clips + 1 concat

    // Check progress percent updates
    expect(progress.updateJobProgress).toHaveBeenCalledWith(exportJobId, 40, 'user-123'); // 1/2 of 80%
    expect(progress.updateJobProgress).toHaveBeenCalledWith(exportJobId, 80, 'user-123'); // 2/2 of 80%
    expect(progress.updateJobProgress).toHaveBeenCalledWith(exportJobId, 90, 'user-123'); // concat 90%

    // Check completion status and output url
    expect(prisma.exportJob.update).toHaveBeenCalledWith({
      where: { id: exportJobId },
      data: expect.objectContaining({
        status: 'completed',
        output_url: 'http://minio/exports/proj-123/export-123.mp4',
        progress_percent: 100,
        output_file_size: 2048000
      })
    });

    expect(progress.broadcastExportCompleted).toHaveBeenCalledWith(
      exportJobId,
      'user-123',
      'http://minio/exports/proj-123/export-123.mp4'
    );
  });
});
