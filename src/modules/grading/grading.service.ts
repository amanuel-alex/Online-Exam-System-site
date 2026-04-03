import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeManualAnswerDto } from './dto/grade-manual-answer.dto';
import { Prisma, QuestionType, Role, AttemptStatus } from '@prisma/client';
import { ExaminaQueueService, QueueName } from '../../common/queue/queue.service';
import { createHash } from 'crypto';

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ExaminaQueueService,
  ) {}

  async finalizeResultIfComplete(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { examQuestions: { include: { question: true, version: true } } } },
        answers: true,
        result: true,
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found.');
    if (attempt.result?.isLocked) throw new ForbiddenException('Result is locked and cannot be modified.');

    const totalEarned = attempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const totalMax = attempt.exam.examQuestions.reduce((sum, eq) => sum + (eq.pointsOverride ?? eq.version?.points ?? 1), 0);
    
    const percentage = (totalEarned / (totalMax || 1)) * 100;
    const isPassed = percentage >= attempt.exam.passPercentage;

    // Cryptographic Verification Hash (Anti-Tamper)
    // Format: SHA256(studentId:totalEarned:maxScore:attemptId:SECRET)
    const secret = process.env.RESULT_SECRET || 'EXAMINA_SECRET';
    const hashPayload = `${attempt.studentId}:${totalEarned}:${totalMax}:${attemptId}:${secret}`;
    const verificationHash = createHash('sha256').update(hashPayload).digest('hex');

    const questionsNeeded = attempt.exam.examQuestions.length;
    const questionsGradedCount = attempt.answers.filter(a => a.score !== null).length;
    const isFullyGraded = (questionsGradedCount === questionsNeeded && attempt.status === AttemptStatus.SUBMITTED);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.result.upsert({
        where: { attemptId },
        update: {
          totalScore: totalEarned,
          maxScore: totalMax,
          percentage,
          isPassed,
          verificationHash,
          isLocked: isFullyGraded, // Lock only when 100% graded
        },
        create: {
          attemptId,
          studentId: attempt.studentId,
          organizationId: attempt.organizationId,
          totalScore: totalEarned,
          maxScore: totalMax,
          percentage,
          isPassed,
          verificationHash,
          isLocked: isFullyGraded,
        },
      });

      if (isFullyGraded) {
        await tx.examAttempt.update({
          where: { id: attemptId },
          data: { status: AttemptStatus.GRADED },
        });

        await this.queue.addJob(QueueName.NOTIFICATIONS, 'RESULT_PUBLISHED', {
          userId: attempt.studentId,
          organizationId: attempt.organizationId,
          attemptId: attempt.id,
          payload: { examTitle: attempt.exam.title, resultId: result.id }
        });
      }

      return { result, isFullyGraded };
    });
  }

  // ─────────────────────────────────────────────
  // OMITTED PRE-EXISTING LOGIC FOR BREVITY (autoGradeAttempt, manualGrade, releaseResult)
  // ─────────────────────────────────────────────
}
