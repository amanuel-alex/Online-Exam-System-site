import { Module } from '@nestjs/common';
import { ExamAttemptService } from './exam-attempt.service';
import { ExamAttemptController } from './exam-attempt.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExamAttemptController],
  providers: [ExamAttemptService],
  exports: [ExamAttemptService],
})
export class ExamAttemptModule {}
