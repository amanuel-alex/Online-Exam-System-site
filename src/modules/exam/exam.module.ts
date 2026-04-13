import { Module } from '@nestjs/common';
import { ExamService } from './exam.service';
import { ExamController } from './exam.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';

@Module({
  imports: [PrismaModule, QuestionBankModule],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService],
})
export class ExamModule {}
