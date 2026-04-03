import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AssignQuestionsDto } from './dto/assign-questions.dto';
import { ExamQueryDto } from './dto/exam-query.dto';
import { Prisma, Role, AttemptStatus } from '@prisma/client';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CREATE EXAM
  // ─────────────────────────────────────────────

  async create(dto: CreateExamDto, currentUser: any) {
    this.assertCanManageExams(currentUser);

    const organizationId = this.resolveOrganizationId(dto.organizationId, currentUser);

    return this.prisma.exam.create({
      data: {
        organizationId,
        createdById: currentUser.id,
        title: dto.title,
        description: dto.description,
        startTime: dto.startTime,
        endTime: dto.endTime,
        durationMinutes: dto.durationMinutes,
        maxAttempts: dto.maxAttempts,
        randomizeQuestions: dto.randomizeQuestions,
        passPercentage: dto.passPercentage,
        isPublished: dto.isPublished,
      },
    });
  }

  // ─────────────────────────────────────────────
  // READ LIST & FILTERS
  // ─────────────────────────────────────────────

  async findAll(query: ExamQueryDto, currentUser: any) {
    const { page = 1, limit = 10, search, publishedOnly, organizationId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExamWhereInput = {};

    // Multi-tenant scoping
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      where.organizationId = currentUser.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (publishedOnly) {
      where.isPublished = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [exams, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { examQuestions: true, attempts: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      data: exams,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─────────────────────────────────────────────
  // READ SINGLE
  // ─────────────────────────────────────────────

  async findOne(id: string, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: { options: { orderBy: { orderIndex: 'asc' } } },
            },
          },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found.');
    this.assertOrgAccess(exam.organizationId, currentUser);

    return exam;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  async update(id: string, dto: UpdateExamDto, currentUser: any) {
    const exam = await this.findOne(id, currentUser);
    this.assertCanManageExams(currentUser);

    return this.prisma.exam.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.organizationId && { organizationId: this.resolveOrganizationId(dto.organizationId, currentUser) }),
      },
    });
  }

  // ─────────────────────────────────────────────
  // ASSIGN QUESTIONS
  // ─────────────────────────────────────────────

  async assignQuestions(examId: string, dto: AssignQuestionsDto, currentUser: any) {
    const exam = await this.findOne(examId, currentUser);
    this.assertCanManageExams(currentUser);

    // Full rewrite of the questions list for atomic update
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete existing associations
      await tx.examQuestion.deleteMany({ where: { examId } });

      // 2. Create new associations
      for (const item of dto.questions) {
        // Validate question exists and belongs to the same org
        const q = await tx.question.findUnique({ where: { id: item.questionId } });
        if (!q) throw new NotFoundException(`Question ${item.questionId} missing.`);
        if (q.organizationId !== exam.organizationId) {
          throw new ForbiddenException(`Organization mismatch for question ${q.id}.`);
        }

        await tx.examQuestion.create({
          data: {
            examId,
            questionId: item.questionId,
            orderIndex: item.orderIndex,
            pointsOverride: item.pointsOverride,
          },
        });
      }
    });

    return { message: 'Questions assigned successfully.' };
  }

  // ─────────────────────────────────────────────
  // START EXAM (Attempt Management)
  // ─────────────────────────────────────────────

  async startExam(examId: string, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: { select: { examQuestions: true } },
      },
    });

    if (!exam || !exam.isPublished) throw new NotFoundException('Exam not found or unavailable.');
    this.assertOrgAccess(exam.organizationId, currentUser);

    // Check if within time window
    const now = new Date();
    if (exam.startTime && now < exam.startTime) throw new ForbiddenException('Exam has not started yet.');
    if (exam.endTime && now > exam.endTime) throw new ForbiddenException('Exam scheduling has ended.');

    // Count attempts
    const attemptCount = await this.prisma.attempt.count({
      where: { examId, studentId: currentUser.id },
    });

    if (attemptCount >= exam.maxAttempts) {
      throw new ConflictException('Maximum attempts reached for this exam.');
    }

    // Start fresh attempt record
    const attempt = await this.prisma.attempt.create({
      data: {
        examId,
        studentId: currentUser.id,
        attemptNumber: attemptCount + 1,
        status: AttemptStatus.IN_PROGRESS,
        startTime: now,
      },
    });

    // Provide the questions to the student (sanitized - no correct answers!)
    const questions = await this.getExamQuestions(examId, true);

    return {
      attemptId: attempt.id,
      meta: {
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        totalQuestions: exam._count.examQuestions,
        endTime: exam.durationMinutes ? new Date(now.getTime() + exam.durationMinutes * 60000) : exam.endTime,
      },
      questions,
    };
  }

  // ─────────────────────────────────────────────
  // GET EXAM QUESTIONS (Internal & Public)
  // ─────────────────────────────────────────────

  async getExamQuestions(examId: string, sanitize = true) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: {
          include: {
            question: {
              include: {
                options: { orderBy: { orderIndex: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found.');

    let questions = exam.examQuestions.map((eq) => {
      const q = eq.question;
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        points: eq.pointsOverride ?? q.points,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          orderIndex: o.orderIndex,
          ...(sanitize ? {} : { isCorrect: o.isCorrect }), // Hide correct answers for students
        })),
      };
    });

    // Randomize if requested
    if (exam.randomizeQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
    } else {
      // Otherwise use the stored orderIndex
      // Note: we already have eq.orderIndex but the initial map lost it, so let's re-sort or use the initial sort
      questions = exam.examQuestions
        .sort((a,b) => a.orderIndex - b.orderIndex)
        .map(eq => {
          const q = eq.question;
          return {
            id: q.id,
            text: q.text,
            type: q.type,
            points: eq.pointsOverride ?? q.points,
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text,
              orderIndex: o.orderIndex,
              ...(sanitize ? {} : { isCorrect: o.isCorrect }),
            })),
          };
        });
    }

    return questions;
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private resolveOrganizationId(dtoOrgId: string | undefined, currentUser: any): string {
    if (currentUser.role === Role.SYSTEM_ADMIN) {
      const orgId = dtoOrgId ?? currentUser.organizationId;
      if (!orgId) throw new BadRequestException('OrganizationId missing.');
      return orgId;
    }
    return currentUser.organizationId;
  }

  private assertCanManageExams(currentUser: any) {
    const allowed = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('Insufficient permissions to manage exams.');
    }
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Organization scope violation.');
    }
  }
}
