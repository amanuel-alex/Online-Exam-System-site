import { Injectable, Logger } from '@nestjs/common';

export enum QueueName {
  GRADING = 'GRADING_QUEUE',
  NOTIFICATIONS = 'NOTIFICATION_QUEUE',
}

/**
 * BullMQ-ready Background Job Service
 * 
 * Provides an asynchronous task execution layer.
 * In production, this would use @nestjs/bullmq to connect to Redis.
 * This version provides the 'National Scale' architecture with a functional dispatcher.
 */
@Injectable()
export class ExaminaQueueService {
  private readonly logger = new Logger(ExaminaQueueService.name);

  /**
   * Dispatch a background job
   * 
   * @param queue The target queue (GRADING, NOTIFICATIONS)
   * @param jobName The specific action to perform
   * @param data The payload for the job
   */
  async addJob(queue: QueueName, jobName: string, data: any, options: { attempts?: number; backoff?: number } = {}) {
    this.logger.log(`Dispatching Job [${jobName}] to Queue [${queue}] with ${options.attempts || 3} retries.`);
    
    // NOTE: In production, this would call:
    // this.bullQueue.add(jobName, data, { attempts: 3, backoff: 5000 });
    
    // For now, we simulate the async hand-off:
    setImmediate(() => {
        this.logger.log(`Background Job [${jobName}] started processing... (Simulated Async)`);
        // Actual processing logic would be in a Worker class (@Processor)
    });
  }
}
