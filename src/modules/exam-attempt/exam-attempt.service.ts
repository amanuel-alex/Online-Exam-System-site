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
  // START ATTEMPT (Transaction)
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

    // Transaction for atomic start + audit log
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.create({
        data: {
          examId: dto.examId,
          studentId: currentUser.id,
          organizationId: exam.organizationId,
          attemptNumber: pastAttempts + 1,
          status: AttemptStatus.IN_PROGRESS,
          startTime: new Date(),
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
  // SUBMIT ATTEMPT (CRITICAL TRANSACTION)
  // ─────────────────────────────────────────────

  async submitAttempt(attemptId: string, currentUser: any) {
    const attempt = await this.getValidatedActiveAttempt(attemptId, currentUser);

    // Atomic Finalize + Audit
    // Note: Grading usually happens as an async trigger or in the same pipe.
    // Here we ensure the Submission Status and Timestamp are locked together.
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.SUBMITTED,
          endTime: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'EXAM_ATTEMPT_SUBMITTED',
          userId: currentUser.id,
          organizationId: submission.organizationId,
          metadata: { attemptId: submission.id, duration: submission.endTime!.getTime() - submission.startTime.getTime() },
        },
      });

      return {
        message: 'Successfully submitted.',
        attemptId: submission.id,
        submittedAt: submission.endTime,
      };
    });
  }

  // ─────────────────────────────────────────────
  // AUTO-SAVE ANSWER (Idempotent Upsert)
  // ─────────────────────────────────────────────

  async saveAnswer(attemptId: string, dto: SaveAttemptAnswerDto, currentUser: any) {
    const attempt = await this.getValidatedActiveAttempt(attemptId, currentUser);

    const valid = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: attempt.examId, questionId: dto.questionId } },
    });
    if (!valid) throw new BadRequestException('Invalid question for this exam.');

    // The versionId should ideally be captured from the official ExamQuestion mapping
    const versionId = valid.versionId;

    return this.prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      update: {
        textAnswer: dto.textAnswer,
        selectedOptions: dto.selectedOptions || [],
        fileUrl: dto.fileUrl,
        versionId, // Record exactly which version they answered
      },
      create: {
        attemptId,
        questionId: dto.questionId,
        versionId,
        textAnswer: dto.textAnswer,
        selectedOptions: dto.selectedOptions || [],
        fileUrl: dto.fileUrl,
      },
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

  private assertStudentAccess(attempt: any, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (attempt.studentId !== currentUser.id) throw new ForbiddenException('Unauthorized.');
  }
}
