import { Module } from '@nestjs/common';
import { ExamSessionService } from './exam-session.service';
import { ExamSessionController } from './exam-session.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExamSessionController],
  providers: [ExamSessionService],
  exports: [ExamSessionService],
})
export class ExamSessionModule {}
