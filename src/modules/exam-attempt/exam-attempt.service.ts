import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAttemptAnswerDto } from './dto/save-answer.dto';
import { AttemptStatus, Role, Prisma } from '@prisma/client';

@Injectable()
export class ExamAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // START ATTEMPT (Transaction + Idempotency Ready)
  // ─────────────────────────────────────────────

  async startAttempt(dto: StartAttemptDto, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      include: { _count: { select: { examQuestions: true } } },
    });

    if (!exam || !exam.isPublished) throw new NotFoundException('Exam not found.');

    const active = await this.prisma.examAttempt.findFirst({
      where: {
        examId: dto.examId,
        studentId: currentUser.id,
        status: AttemptStatus.IN_PROGRESS,
        deletedAt: null,
      },
    });
    if (active) throw new ConflictException('Ongoing attempt active.');

    const pastAttempts = await this.prisma.examAttempt.count({
      where: { examId: dto.examId, studentId: currentUser.id, deletedAt: null },
    });
    if (pastAttempts >= exam.maxAttempts) throw new ForbiddenException('Limit reached.');

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.create({
        data: {
          examId: dto.examId,
          studentId: currentUser.id,
          organizationId: exam.organizationId,
          attemptNumber: pastAttempts + 1,
          status: AttemptStatus.IN_PROGRESS,
          startTime: new Date(),
          version: 1, // Start with version 1
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'EXAM_ATTEMPT_STARTED',
          userId: currentUser.id,
          organizationId: exam.organizationId,
          metadata: { attemptId: attempt.id, examId: dto.examId },
        },
      });

      return attempt;
    });
  }

  // ─────────────────────────────────────────────
  // SUBMIT ATTEMPT (Optimistic Locking)
  // ─────────────────────────────────────────────

  async submitAttempt(attemptId: string, currentUser: any) {
    // 1. Fetch current record (Head)
    const attempt = await this.getValidatedActiveAttempt(attemptId, currentUser);

    return this.prisma.$transaction(async (tx) => {
      // 2. Perform Update with Version Check (Optimistic Locking)
      // This prevents thousands of submissions for the same attempt mapping twice.
      const result = await tx.examAttempt.updateMany({
        where: {
          id: attemptId,
          version: attempt.version, // Ensure version matches what we knew
          status: AttemptStatus.IN_PROGRESS, // Extra safety
        },
        data: {
          status: AttemptStatus.SUBMITTED,
          endTime: new Date(),
          version: { increment: 1 }, // Advance version
        },
      });

      if (result.count === 0) {
        // This means another thread/process updated the attempt already
        throw new ConflictException('Submission conflict detected. Attempt might have already been processed.');
      }

      const submission = await tx.examAttempt.findUnique({ where: { id: attemptId } });

      await tx.auditLog.create({
        data: {
          action: 'EXAM_ATTEMPT_SUBMITTED',
          userId: currentUser.id,
          organizationId: submission!.organizationId,
          metadata: { attemptId: submission!.id, version: submission!.version },
        },
      });

      return {
        message: 'Successfully submitted.',
        attemptId: submission!.id,
        submittedAt: submission!.endTime,
      };
    });
  }

  // ─────────────────────────────────────────────
  // AUTO-SAVE ANSWER (Conflict Avoidance)
  // ─────────────────────────────────────────────

  async saveAnswer(attemptId: string, dto: SaveAttemptAnswerDto, currentUser: any) {
    const attempt = await this.getValidatedActiveAttempt(attemptId, currentUser);

    const valid = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: attempt.examId, questionId: dto.questionId } },
    });
    if (!valid) throw new BadRequestException('Invalid question.');

    // VersionId is fixed at exam creation time
    const versionId = valid.versionId;

    return this.prisma.$transaction(async (tx) => {
      // Atomic increment version on every save helps track mutation flow
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: { version: { increment: 1 } },
      });

      return tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
        update: {
          textAnswer: dto.textAnswer,
          selectedOptions: (dto as any).selectedOptions || [],
          fileUrl: dto.fileUrl,
          versionId, 
        },
        create: {
          attemptId,
          questionId: dto.questionId,
          versionId,
          textAnswer: dto.textAnswer,
          selectedOptions: (dto as any).selectedOptions || [],
          fileUrl: dto.fileUrl,
        },
      });
    });
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async getValidatedActiveAttempt(attemptId: string, currentUser: any) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt || attempt.deletedAt) throw new NotFoundException('Attempt not found.');
    this.assertStudentAccess(attempt, currentUser);

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ForbiddenException('Attempt finalized.');
    }

    return attempt;
  }

  async getRemainingTime(id: string, currentUser: any) {
    const attempt = await this.getValidatedActiveAttempt(id, currentUser);
    const now = new Date();
    const startTime = new Date(attempt.startTime);
    const deadline = attempt.exam.durationMinutes 
      ? new Date(startTime.getTime() + attempt.exam.durationMinutes * 60000)
      : attempt.exam.endTime;
      
    if (!deadline) return { remainingSeconds: null };
    const remainingSeconds = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
    return { remainingSeconds };
  }

  private assertStudentAccess(attempt: any, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (attempt.studentId !== currentUser.id) throw new ForbiddenException('Unauthorized.');
  }
}
