import { spawn } from 'child_process';
import { FfmpegError } from './error.js';

/**
 * Helper to run ffmpeg or ffprobe CLI commands
 * @param command - The binary to run ('ffmpeg' or 'ffprobe')
 * @param args - Arguments array
 * @param onProgress - Optional callback to handle stdout/stderr line by line
 * @returns Promise that resolves to the combined stdout/stderr as a string if no error occurs
 */
export async function runFfmpegCommand(
  command: 'ffmpeg' | 'ffprobe',
  args: string[],
  onProgress?: (data: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (onProgress) {
        onProgress(text);
      }
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      // ffmpeg writes progress to stderr, so we should call onProgress here as well
      if (onProgress) {
        onProgress(text);
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        // Resolve with stdout (useful for ffprobe json output)
        resolve(output.trim() || errorOutput.trim());
      } else {
        reject(new FfmpegError(`Command failed: ${command} ${args.join(' ')}`, code, errorOutput));
      }
    });

    process.on('error', (err) => {
      reject(new FfmpegError(`Failed to start command: ${command}`, null, err.message));
    });
  });
}
