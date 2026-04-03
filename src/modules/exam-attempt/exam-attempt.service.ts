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
  // START ATTEMPT
  // ─────────────────────────────────────────────

  async startAttempt(dto: StartAttemptDto, currentUser: any) {
    // 1. Fetch exam metadata
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      include: {
        _count: { select: { examQuestions: true } }
      }
    });

    if (!exam || !exam.isPublished) throw new NotFoundException('Exam not found or unpublished.');

    // 2. Prevent Multiple Active Attempts
    const active = await this.prisma.examAttempt.findFirst({
      where: {
        examId: dto.examId,
        studentId: currentUser.id,
        status: AttemptStatus.IN_PROGRESS,
      },
    });
    if (active) throw new ConflictException('You have an ongoing attempt session for this exam.');

    // 3. Scheduling check
    const now = new Date();
    if (exam.startTime && now < exam.startTime) throw new ForbiddenException('Exam window not open yet.');
    if (exam.endTime && now > exam.endTime) throw new ForbiddenException('Exam window closed.');

    // 4. Max Attempts check
    const pastAttempts = await this.prisma.examAttempt.count({
      where: { examId: dto.examId, studentId: currentUser.id },
    });
    if (pastAttempts >= exam.maxAttempts) throw new ForbiddenException('Maximum attempt limit reached.');

    // 5. Create new session
    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId: dto.examId,
        studentId: currentUser.id,
        attemptNumber: pastAttempts + 1,
        status: AttemptStatus.IN_PROGRESS,
        startTime: now,
      },
    });

    return {
      attemptId: attempt.id,
      startedAt: attempt.startTime,
      meta: {
        title: exam.title,
        durationLimit: exam.durationMinutes,
        totalQuestions: exam._count.examQuestions,
      },
    };
  }

  // ─────────────────────────────────────────────
  // AUTO-SAVE ANSWER
  // ─────────────────────────────────────────────

  async saveAnswer(attemptId: string, dto: SaveAttemptAnswerDto, currentUser: any) {
    const attempt = await this.getValidatedActiveAttempt(attemptId, currentUser);

    // Verify question is actually in this exam
    const valid = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId: attempt.examId, questionId: dto.questionId } },
    });
    if (!valid) throw new BadRequestException('Question is not part of this exam.');

    // Upsert the answer
    return this.prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      update: {
        textAnswer: dto.textAnswer,
        optionId: dto.optionId,
        fileUrl: dto.fileUrl,
      },
      create: {
        attemptId,
        questionId: dto.questionId,
        textAnswer: dto.textAnswer,
        optionId: dto.optionId,
        fileUrl: dto.fileUrl,
      },
    });
  }

  // ─────────────────────────────────────────────
  // REMAINING TIME
  // ─────────────────────────────────────────────

  async getRemainingTime(attemptId: string, currentUser: any) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new NotFoundException('Attempt not found.');
    this.assertStudentAccess(attempt, currentUser);

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
        return { remainingSeconds: 0, status: attempt.status };
    }

    const { remainingSeconds } = this.calculateRemainingTime(attempt);
    
    // Auto-submission trigger logic hint:
    // This could also be checked in a middleware or a cron/background job,
    // but we enforce it on every save/submit request (see getValidatedActiveAttempt).

    return {
      remainingSeconds: Math.max(0, remainingSeconds),
      status: remainingSeconds <= 0 ? 'EXPIRED' : attempt.status,
    };
  }

  // ─────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────

  async submitAttempt(attemptId: string, currentUser: any) {
    const attempt = await this.getValidatedActiveAttempt(attemptId, currentUser);

    const submission = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.SUBMITTED,
        endTime: new Date(),
      },
    });

    // TODO: Emit event for auto-grading
    return {
      message: 'Attempt submitted successfully.',
      attemptId,
      submittedAt: submission.endTime,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async getValidatedActiveAttempt(attemptId: string, currentUser: any) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new NotFoundException('Attempt session not found.');
    this.assertStudentAccess(attempt, currentUser);

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ForbiddenException('Attempt is already finalized.');
    }

    // Time Limit Expiration Logic
    const { expired } = this.calculateRemainingTime(attempt);
    if (expired) {
      // IMPLEMENT AUTO-SUBMIT HERE:
      // Finalize the record immediately when a request is made after expiration.
      await this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.SUBMITTED, endTime: new Date() },
      });
      throw new ForbiddenException('Time limit exceeded. Attempt has been auto-submitted.');
    }

    return attempt;
  }

  private calculateRemainingTime(attempt: any) {
    const now = new Date();
    const startTime = new Date(attempt.startTime);

    // Limit is the earlier of:
    // 1. durationMinutes since start
    // 2. exam's strict endTime
    const candidate1 = attempt.exam.durationMinutes 
       ? startTime.getTime() + attempt.exam.durationMinutes * 60000 
       : Infinity;
    
    const candidate2 = attempt.exam.endTime ? new Date(attempt.exam.endTime).getTime() : Infinity;

    const deadline = Math.min(candidate1, candidate2);
    
    const remainingMs = deadline - now.getTime();
    return {
       remainingSeconds: Math.floor(remainingMs / 1000),
       expired: remainingMs <= 0,
    };
  }

  private assertStudentAccess(attempt: any, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (attempt.studentId !== currentUser.id) {
       throw new ForbiddenException('Access denied to this attempt session.');
    }
  }
}
