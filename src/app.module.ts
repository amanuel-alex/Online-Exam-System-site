import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { QuestionBankModule } from './modules/question-bank/question-bank.module';
import { ExamModule } from './modules/exam/exam.module';
import { ExamAttemptModule } from './modules/exam-attempt/exam-attempt.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    QuestionBankModule,
    ExamModule,
    ExamAttemptModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
