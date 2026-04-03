import { Module, Global } from '@nestjs/common';
import { ExaminaCacheService } from './cache.service';

@Global()
@Module({
  providers: [ExaminaCacheService],
  exports: [ExaminaCacheService],
})
export class CacheModule {}
