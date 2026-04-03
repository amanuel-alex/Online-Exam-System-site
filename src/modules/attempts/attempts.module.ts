import { Module } from '@nestjs/common';
import { AttemptService } from './attempts.service';
import { AttemptController } from './attempts.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttemptController],
  providers: [AttemptService],
  exports: [AttemptService],
})
export class AttemptModule {}
