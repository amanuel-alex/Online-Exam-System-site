import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { Prisma, AttemptStatus, Role } from '@prisma/client';

@Injectable()
export class AttemptService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // START ATTEMPT
  // ─────────────────────────────────────────────

  /**
   * Logic previously in ExamService, now moved here for separation of concerns.
   */
  async startAttempt(examId: string, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { _count: { select: { examQuestions: true } } },
    });

    if (!exam || !exam.isPublished) throw new NotFoundException('Exam is unavailable.');
    this.assertOrgAccess(exam.organizationId, currentUser);

    const now = new Date();
    if (exam.startTime && now < exam.startTime) throw new ForbiddenException('Exam window not open.');
    if (exam.endTime && now > exam.endTime) throw new ForbiddenException('Exam window closed.');

    const attemptCount = await this.prisma.examAttempt.count({
      where: { examId, studentId: currentUser.id },
    });
    if (attemptCount >= exam.maxAttempts) throw new ConflictException('Max attempts reached.');

    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId,
        studentId: currentUser.id,
        organizationId: exam.organizationId,
        attemptNumber: attemptCount + 1,
        status: AttemptStatus.IN_PROGRESS,
        startTime: now,
      },
    });

    return attempt;
  }

  // ─────────────────────────────────────────────
  // SAVE ANSWER (Auto-save)
  // ─────────────────────────────────────────────

  async saveAnswer(attemptId: string, dto: SaveAnswerDto, currentUser: any) {
    const attempt = await this.assertAttemptAccess(attemptId, currentUser);

    // Validate that the question actually belongs to the exam!
    const examQuestion = await this.prisma.examQuestion.findUnique({
      where: {
        examId_questionId: {
          examId: attempt.examId,
          questionId: dto.questionId,
        },
      },
    });

    if (!examQuestion) {
      throw new BadRequestException('This question is not part of the active exam.');
    }

    // Handle polymorphic-like upsert
    // Prisma .upsert for unique constraints: [attemptId, questionId]
    return this.prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: dto.questionId,
        },
      },
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
  // SUBMIT ATTEMPT
  // ─────────────────────────────────────────────

  async submitAttempt(attemptId: string, currentUser: any) {
    const attempt = await this.assertAttemptAccess(attemptId, currentUser);

    const submission = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.SUBMITTED,
        endTime: new Date(),
      },
    });

    // TODO: Trigger auto-grading if applicable
    // TODO: Audit Log -> Action: SUBMIT_EXAM, Target: attemptId
    return { message: 'Attempt submitted successfully.', attemptId, submissionTime: submission.endTime };
  }

  // ─────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────

  async findAttempt(id: string, currentUser: any) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id },
      include: {
        exam: { select: { title: true, durationMinutes: true, endTime: true } },
        answers: { select: { id: true, questionId: true, textAnswer: true, optionId: true, fileUrl: true } },
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found.');
    this.assertAttemptAccessById(attempt, currentUser);

    return attempt;
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async assertAttemptAccess(attemptId: string, currentUser: any) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new NotFoundException('Attempt session not found.');
    this.assertAttemptAccessById(attempt, currentUser);

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ForbiddenException('Attempt is already finalized (submitted/graded).');
    }

    // Time limit check
    const now = new Date();
    const startTime = new Date(attempt.startTime);
    const deadline = attempt.exam.durationMinutes 
      ? new Date(startTime.getTime() + attempt.exam.durationMinutes * 60000)
      : attempt.exam.endTime;

    if (deadline && now > deadline) {
      // Auto-submit if time exceeded and user tries to save/submit
      await this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.SUBMITTED, endTime: deadline },
      });
      throw new ForbiddenException('Time limit exceeded. Attempt auto-submitted.');
    }

    return attempt;
  }

  private assertAttemptAccessById(attempt: any, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (attempt.studentId !== currentUser.id) {
       throw new ForbiddenException('You are not authorized for this attempt session.');
    }
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Organization mismatch.');
    }
  }
}
