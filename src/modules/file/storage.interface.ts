export interface StorageProvider {
  upload(file: any): Promise<string>;
  delete(fileUrl: string): Promise<void>;
}
