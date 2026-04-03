import { Module, Global } from '@nestjs/common';
import { ExaminaQueueService } from './queue.service';

@Global()
@Module({
  providers: [ExaminaQueueService],
  exports: [ExaminaQueueService],
})
export class QueueModule {}
