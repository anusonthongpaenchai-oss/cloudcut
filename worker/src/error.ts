export class WorkerError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class FfmpegError extends WorkerError {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string
  ) {
    super(`FFmpeg Error: ${message} (Exit Code: ${exitCode})\nStderr: ${stderr}`);
    this.name = 'FfmpegError';
  }
}

export class StorageError extends WorkerError {
  constructor(message: string, originalError?: unknown) {
    super(`Storage Error: ${message}`, originalError);
    this.name = 'StorageError';
  }
}
