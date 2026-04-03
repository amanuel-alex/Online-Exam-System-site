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
import { ExamSessionModule } from './modules/exam-session/exam-session.module';
import { GradingModule } from './modules/grading/grading.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    QuestionBankModule,
    ExamModule,
    ExamSessionModule,
    ExamAttemptModule,
    GradingModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
