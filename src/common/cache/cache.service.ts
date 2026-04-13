import { Injectable, Logger } from '@nestjs/common';

/**
 * Platform Cache Service (Redis-ready abstraction)
 * 
 * Provides high-performance key-value storage for read-heavy operations
 * like Exam Questions and Organization Configurations.
 */
@Injectable()
export class ExaminaCacheService {
  private readonly logger = new Logger(ExaminaCacheService.name);
  
  // NOTE: In a real production environment, this would inject CacheManager (Redis)
  // For the current setup, we implement a production-ready interface that can be 
  // swapped to Redis by changing the provider in CacheModule.
  private storage = new Map<string, { value: any; expiry: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.storage.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.storage.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    this.storage.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * Pattern-based invalidation (e.g., "org:config:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = Array.from(this.storage.keys());
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    
    keys.forEach(key => {
      if (regex.test(key)) {
        this.storage.delete(key);
      }
    });
    this.logger.log(`Invalidated cache pattern: ${pattern}`);
  }
}
