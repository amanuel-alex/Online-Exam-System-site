import { Injectable, Logger } from '@nestjs/common';
import { IStorageProvider } from './storage.interface';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalDiskStorage implements IStorageProvider {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly logger = new Logger(LocalDiskStorage.name);

  async upload(file: any, path: string): Promise<string> {
    const fullDir = join(this.uploadDir, path);
    await fs.mkdir(fullDir, { recursive: true });

    const fileName = `${uuidv4()}-${file.originalname}`;
    const filePath = join(fullDir, fileName);

    await fs.writeFile(filePath, file.buffer);
    return `/uploads/${path}/${fileName}`;
  }

  async getDownloadUrl(fileKey: string): Promise<string> {
    // Local files are served directly; for signed URLs, would require a proxy
    return `/uploads/${fileKey}`;
  }

  async delete(fileUrl: string): Promise<void> {
    const relativePath = fileUrl.replace('/uploads/', '');
    const fullPath = join(this.uploadDir, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (e) {
      this.logger.warn(`Could not delete file: ${fullPath}`);
    }
  }
}
