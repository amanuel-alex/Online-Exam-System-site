import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage.interface';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalDiskStorage implements StorageProvider {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  async upload(file: any): Promise<string> {
    // Ensure directory exists
    await fs.mkdir(this.uploadDir, { recursive: true });

    const fileName = `${uuidv4()}-${file.originalname}`;
    const filePath = join(this.uploadDir, fileName);

    await fs.writeFile(filePath, file.buffer);

    // In local dev, we return a local URL or path
    // For production, this would be the S3 public URL
    return `/uploads/${fileName}`;
  }

  async delete(fileUrl: string): Promise<void> {
    const fileName = fileUrl.split('/').pop();
    if (fileName) {
      const filePath = join(this.uploadDir, fileName);
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // Log error but don't fail for cleanup
      }
    }
  }
}
