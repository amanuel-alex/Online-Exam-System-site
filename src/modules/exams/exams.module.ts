import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';

@Module({
  imports: [PrismaModule, QuestionBankModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
