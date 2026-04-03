import { Injectable, Logger } from '@nestjs/common';
import { IStorageProvider } from './storage.interface';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(S3StorageService.name);

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || 'examina-national-grid';
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * National Cloud Storage Adapter (HA-Stateless)
   * 
   * Ensures every document/ID uploaded is persisted to a distributed 
   * cloud bucket. Necessary for horizontal scaling (Backend Clusters).
   */
  async upload(file: any, path: string): Promise<string> {
    const key = `${path}/${Date.now()}-${file.originalname}`;
    
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
      
      const baseUrl = process.env.S3_PUBLIC_URL || `https://${this.bucket}.s3.amazonaws.com`;
      return `${baseUrl}/${key}`;
    } catch (err) {
      this.logger.error(`S3 Cloud Upload Failed: ${err.message}`);
      throw new Error('Could not upload file to high-availability storage.');
    }
  }

  async getDownloadUrl(fileKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}
