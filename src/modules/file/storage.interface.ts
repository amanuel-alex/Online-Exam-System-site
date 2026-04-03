export interface IStorageProvider {
  /**
   * Performs an atomic upload of the document or media artifact to a 
   * distributed storage cluster.
   */
  upload(file: any, path: string): Promise<string>;
  
  /**
   * Retrieves a time-limited, cryptographically-signed download URL 
   * for the specified storage key.
   */
  getDownloadUrl(fileKey: string): Promise<string>;
  
  /**
   * Deletes a resource from the storage engine.
   */
  delete?(fileUrl: string): Promise<void>;
}
