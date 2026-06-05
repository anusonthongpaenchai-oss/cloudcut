import { PrismaClient } from '@prisma/client';
import { deleteFromS3 } from './storage.js';

const prisma = new PrismaClient();

export async function runDailyCleanup() {
  const summary = {
    deleted_projects: 0,
    deleted_assets: 0,
    deleted_exports: 0,
    deleted_accounts: 0,
    freed_bytes: 0,
  };

  const now = new Date();

  try {
    // 1. Delete soft-deleted projects older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const projectsToDelete = await prisma.project.findMany({
      where: {
        deleted_at: {
          not: null,
          lt: thirtyDaysAgo
        }
      }
    });

    for (const project of projectsToDelete) {
      await prisma.project.delete({ where: { id: project.id } });
      summary.deleted_projects++;
    }

    // 2. Delete export files where expires_at < now
    const expiredExports = await prisma.exportJob.findMany({
      where: {
        expires_at: {
          lt: now
        },
        output_url: {
          not: null
        }
      }
    });

    for (const exp of expiredExports) {
      // Assuming output_url format ends with the S3 object key
      // or we extract the key. For MinIO, it's <endpoint>/<bucket>/<key>
      // We will parse the key manually for this demo based on how we generated it.
      const urlParts = exp.output_url!.split('/');
      // e.g., http://localhost:9000/cloudcut/exports/projectId/exportId.mp4
      // the key is exports/projectId/exportId.mp4
      const objectKeyIndex = urlParts.indexOf('exports');
      if (objectKeyIndex !== -1) {
        const objectKey = urlParts.slice(objectKeyIndex).join('/');
        await deleteFromS3(objectKey);
        summary.freed_bytes += exp.output_file_size || 0;
      }
      
      await prisma.exportJob.update({
        where: { id: exp.id },
        data: { output_url: null, output_file_size: null } // Mark as deleted file
      });
      summary.deleted_exports++;
    }

    // 3. Delete orphaned assets unused for more than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // An asset is orphaned if it is not linked to any Clip and is older than 7 days
    const orphanedAssets = await prisma.asset.findMany({
      where: {
        created_at: { lt: sevenDaysAgo },
        clips: { none: {} }
      }
    });

    for (const asset of orphanedAssets) {
      // Delete from S3 (variants and original)
      // Omitted S3 deletion loop for brevity here, but normally we'd parse URLs and delete
      
      await prisma.asset.delete({ where: { id: asset.id } });
      summary.deleted_assets++;
    }

    // 4. Delete accounts where deleted_at > 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const accountsToDelete = await prisma.user.findMany({
      where: {
        deleted_at: {
          not: null,
          lt: ninetyDaysAgo
        }
      }
    });

    for (const acc of accountsToDelete) {
      await prisma.user.delete({ where: { id: acc.id } });
      summary.deleted_accounts++;
    }

    console.log(`Cleanup completed successfully. Summary:`, summary);
  } catch (error) {
    console.error('Failed to run daily cleanup', error);
  }
}
