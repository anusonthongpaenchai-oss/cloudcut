import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { StorageError } from './error.js';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const bucket = process.env.AWS_S3_BUCKET || 'cloudcut';
const endpoint = process.env.AWS_ENDPOINT_URL_S3 || 'http://localhost:9000';

const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true, // required for MinIO
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
});

export async function uploadToS3(filePath: string, objectKey: string, contentType: string): Promise<string> {
  try {
    const fileStream = fs.createReadStream(filePath);
    
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: fileStream,
        ContentType: contentType,
      })
    );

    // Using forcePathStyle means the URL is <endpoint>/<bucket>/<key>
    // However, if the frontend accesses it directly, we might need a public URL format
    return `${endpoint}/${bucket}/${objectKey}`;
  } catch (error) {
    throw new StorageError(`Failed to upload ${filePath} to MinIO`, error);
  }
}

export async function getPresignedUrl(objectKey: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    throw new StorageError(`Failed to generate presigned URL for ${objectKey}`, error);
  }
}

export async function deleteFromS3(objectKey: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );
  } catch (error) {
    throw new StorageError(`Failed to delete ${objectKey} from MinIO`, error);
  }
}

export async function downloadToTemp(objectUrl: string, tempFilePath: string): Promise<void> {
  // If objectUrl is a full URL, we can just fetch it. 
  // Assuming the worker has network access to the URL
  try {
    const response = await fetch(objectUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    
    const dir = path.dirname(tempFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileStream = fs.createWriteStream(tempFilePath);
    if (!response.body) throw new Error('Response body is empty');
    
    // Web Streams to Node Streams
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
    }
    
    fileStream.end();
  } catch (error) {
    throw new StorageError(`Failed to download file from ${objectUrl} to ${tempFilePath}`, error);
  }
}
