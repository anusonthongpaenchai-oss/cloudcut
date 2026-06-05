import { PrismaClient, ClipEffectType } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runFfmpegCommand } from './ffmpeg.js';
import { downloadToTemp, uploadToS3 } from './storage.js';
import { updateJobProgress, broadcastExportCompleted } from './progress.js';
import { WorkerError } from './error.js';

const prisma = new PrismaClient();

async function getTempDir(jobId: string): Promise<string> {
  const tempDir = path.join('/tmp', 'cloudcut', jobId);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to clean up temp dir ${tempDir}:`, error);
  }
}

function msToFfmpegTime(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().substr(11, 12); // HH:mm:ss.SSS
}

export async function renderExport(jobId: string, exportJobId: string) {
  const exportJob = await prisma.exportJob.findUnique({
    where: { id: exportJobId },
    include: { project: true }
  });

  if (!exportJob) throw new WorkerError(`ExportJob ${exportJobId} not found`);
  
  // Mark as processing
  await prisma.exportJob.update({
    where: { id: exportJobId },
    data: { status: 'processing', started_at: new Date() }
  });

  const tempDir = await getTempDir(jobId);
  
  try {
    // 1. Load timeline data (primary video track)
    const tracks = await prisma.track.findMany({
      where: { project_id: exportJob.project_id, type: 'video' },
      orderBy: { order_index: 'asc' }
    });
    
    if (tracks.length === 0) throw new WorkerError('No video tracks found in project');
    const primaryTrack = tracks[0];

    const clips = await prisma.clip.findMany({
      where: { track_id: primaryTrack.id },
      include: { asset: true, effects: { orderBy: { order_index: 'asc' } } },
      orderBy: { track_position_ms: 'asc' }
    });

    if (clips.length === 0) throw new WorkerError('No clips found in primary track');

    const segmentFiles: string[] = [];
    let processedClips = 0;

    // 2. Trim and process each clip
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!clip.asset.original_url) continue;

      // Check for cancellation
      const currentJob = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
      if (currentJob?.status === 'canceled') {
        throw new WorkerError('Export was canceled');
      }

      const inputPath = path.join(tempDir, `input_${i}.mp4`);
      await downloadToTemp(clip.asset.original_url, inputPath);

      let segmentPath = path.join(tempDir, `segment_${i}.mp4`);

      // Apply effects if present
      let vfFilters: string[] = [];
      const hasEffects = clip.effects.some(e => e.enabled);

      if (hasEffects) {
        // Build effect string: eq=brightness=X:contrast=Y:saturation=Z
        let brightness = 0;
        let contrast = 1.0;
        let saturation = 1.0;

        for (const effect of clip.effects) {
          if (!effect.enabled) continue;
          const params = effect.params as any;
          if (effect.type === ClipEffectType.brightness) brightness = params.value || 0;
          if (effect.type === ClipEffectType.contrast) contrast = params.value || 1.0;
          if (effect.type === ClipEffectType.saturation) saturation = params.value || 1.0;
        }
        vfFilters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
      }

      const ffmpegArgs = [
        '-i', inputPath,
        '-ss', msToFfmpegTime(clip.in_point_ms),
        '-to', msToFfmpegTime(clip.out_point_ms),
      ];

      if (vfFilters.length > 0) {
        ffmpegArgs.push('-vf', vfFilters.join(','));
      }

      ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac', segmentPath);

      await runFfmpegCommand('ffmpeg', ffmpegArgs);
      segmentFiles.push(`file '${segmentPath}'`);
      
      // Update progress
      processedClips++;
      const progressPercent = Math.floor((processedClips / clips.length) * 80); // 80% for segmenting
      await updateJobProgress(exportJobId, progressPercent, exportJob.request_by);
    }

    // 3. Concat all segments
    const concatListPath = path.join(tempDir, 'segments.txt');
    await fs.writeFile(concatListPath, segmentFiles.join('\n'));

    const outputPath = path.join(tempDir, 'output.mp4');
    
    // Requirements: ffmpeg -f concat -safe 0 -i segments.txt -c:v libx264 -c:a aac output.mp4
    await runFfmpegCommand('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      outputPath
    ]);

    await updateJobProgress(exportJobId, 90, exportJob.request_by); // 90% for concat

    // 4. Upload output
    const objectKey = `exports/${exportJob.project_id}/${exportJobId}.mp4`;
    const outputUrl = await uploadToS3(outputPath, objectKey, 'video/mp4');

    const stat = await fs.stat(outputPath);

    // 5. Update Job as completed
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'completed',
        completed_at: new Date(),
        output_url: outputUrl,
        output_file_size: stat.size,
        progress_percent: 100,
      }
    });

    // 6. Broadcast completion
    await broadcastExportCompleted(exportJobId, exportJob.request_by, outputUrl);

  } catch (error) {
    // Check if it's a cancellation or failure
    const currentJob = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
    const isCanceled = currentJob?.status === 'canceled';

    if (!isCanceled) {
      await prisma.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: 'failed',
          error_message: (error as Error).message,
        }
      });
    }
    throw error; // Re-throw for BullMQ retry / dead-letter
  } finally {
    await cleanupTempDir(tempDir);
  }
}
