import Pusher from 'pusher';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'ap1',
  useTLS: true,
});

export async function updateJobProgress(exportJobId: string, progressPercent: number, userId: string) {
  try {
    // 1. Update the database
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: { progress_percent: progressPercent },
    });

    // 2. Broadcast via Pusher on `private-user-{userId}`
    const channelName = `private-user-${userId}`;
    const eventName = 'export-progress';
    
    await pusher.trigger(channelName, eventName, {
      exportJobId,
      progressPercent,
    });
  } catch (error) {
    console.error(`Failed to update progress for export job ${exportJobId}:`, error);
  }
}

export async function broadcastExportCompleted(exportJobId: string, userId: string, outputUrl: string) {
  try {
    const channelName = `private-user-${userId}`;
    const eventName = 'export-completed';
    
    await pusher.trigger(channelName, eventName, {
      exportJobId,
      outputUrl,
      status: 'completed',
    });
  } catch (error) {
    console.error(`Failed to broadcast completion for export job ${exportJobId}:`, error);
  }
}
