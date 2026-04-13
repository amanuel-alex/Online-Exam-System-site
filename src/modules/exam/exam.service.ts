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
import { AssignQuestionsDto } from '../exams/dto/assign-questions.dto'; // Reuse for mappings
import { AutoSelectQuestionsDto } from './dto/auto-select.dto';
import { ExamQueryDto } from '../exams/dto/exam-query.dto';
import { Prisma, Role, AttemptStatus } from '@prisma/client';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CREATE
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
  // READ
  // ─────────────────────────────────────────────

  async findAll(query: ExamQueryDto, currentUser: any) {
    const { page = 1, limit = 10, search, publishedOnly, organizationId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExamWhereInput = {};

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
          _count: { select: { examQuestions: true } }
        }
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      data: exams,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: { 
                versions: {
                  orderBy: { versionNumber: 'desc' },
                  take: 1,
                  include: { options: { orderBy: { orderIndex: 'asc' } } }
                } 
              }
            }
          }
        }
      }
    });

    if (!exam) throw new NotFoundException('Exam not found.');
    this.assertOrgAccess(exam.organizationId, currentUser);

    return exam;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  async update(id: string, dto: UpdateExamDto, currentUser: any) {
    const exam = await this.findOne(id, currentUser); // Ensures existence & org access
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
  // AUTO QUESTION SELECTION (RANDOM FROM BANK)
  // ─────────────────────────────────────────────

  async autoSelectQuestions(examId: string, dto: AutoSelectQuestionsDto, currentUser: any) {
    const exam = await this.findOne(examId, currentUser);
    this.assertCanManageExams(currentUser);

    const organizationId = exam.organizationId;

    // 1. Fetch any questions from the bank matching the filter.
    const matchingIds = await this.prisma.question.findMany({
      where: {
        organizationId,
        isArchived: false,
        ...(dto.difficulty && { difficulty: dto.difficulty }),
        ...(dto.subject && { subject: dto.subject }),
        ...(dto.topic && { topic: dto.topic }),
        ...(dto.tag && { tags: { has: dto.tag } }),
      },
      select: { id: true },
    });

    if (matchingIds.length < dto.count) {
      throw new BadRequestException(
        `Short of questions in bank. Only found ${matchingIds.length} but requested ${dto.count}.`
      );
    }

    // 2. Shuffle and pick random Count
    const selected = matchingIds
      .sort(() => Math.random() - 0.5)
      .slice(0, dto.count);

    // 3. Clear existing and set new randomly picked ones.
    await this.prisma.$transaction(async (tx) => {
      await tx.examQuestion.deleteMany({ where: { examId } });
      await tx.examQuestion.createMany({
        data: selected.map((q, i) => ({
          examId,
          questionId: q.id,
          orderIndex: i,
        })),
      });
    });

    return { message: `Successfully auto-selected ${dto.count} questions for "${exam.title}".` };
  }

  // ─────────────────────────────────────────────
  // START EXAM (Attempt Management)
  // ─────────────────────────────────────────────

  async startExam(examId: string, currentUser: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: { select: { examQuestions: true } },
        examQuestions: {
          include: {
            question: {
              include: { 
                versions: {
                  orderBy: { versionNumber: 'desc' },
                  take: 1,
                  include: { options: { orderBy: { orderIndex: 'asc' } } }
                } 
              }
            }
          }
        }
      },
    });

    if (!exam || !exam.isPublished) throw new NotFoundException('Exam is unavailable.');
    this.assertOrgAccess(exam.organizationId, currentUser);

    // Schedule check
    const now = new Date();
    if (exam.startTime && now < exam.startTime) throw new ForbiddenException('Exam window not open.');
    if (exam.endTime && now > exam.endTime) throw new ForbiddenException('Exam window closed.');

    const attemptCount = await this.prisma.examAttempt.count({ where: { examId, studentId: currentUser.id } });
    if (attemptCount >= exam.maxAttempts) throw new ConflictException('Max attempts reached.');

    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId,
        studentId: currentUser.id,
        organizationId: exam.organizationId,
        attemptNumber: attemptCount + 1,
        status: AttemptStatus.IN_PROGRESS,
      },
    });

    // Handle randomization of questions for the student delivery session.
    let questionData = exam.examQuestions.map((eq) => {
      const q = eq.question;
      const v = q.versions?.[0];
      return {
        id: q.id,
        text: v?.text,
        type: v?.type,
        points: eq.pointsOverride ?? v?.points,
        options: v?.options?.map((o) => ({ id: o.id, text: o.text, orderIndex: o.orderIndex })) ?? [],
      };
    });

    if (exam.randomizeQuestions) {
      questionData = questionData.sort(() => Math.random() - 0.5);
    } else {
      questionData.sort((a,b) => {
        const orderA = exam.examQuestions.find(eq => eq.questionId === a.id)?.orderIndex ?? 0;
        const orderB = exam.examQuestions.find(eq => eq.questionId === b.id)?.orderIndex ?? 0;
        return orderA - orderB;
      });
    }

    return {
      attemptId: attempt.id,
      meta: { title: exam.title, duration: exam.durationMinutes },
      questions: questionData,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private resolveOrganizationId(dtoOrgId: string | undefined, currentUser: any): string {
    if (currentUser.role === Role.SYSTEM_ADMIN) {
      return dtoOrgId ?? currentUser.organizationId;
    }
    return currentUser.organizationId;
  }

  private assertCanManageExams(currentUser: any) {
    const roles: Role[] = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!roles.includes(currentUser.role)) throw new ForbiddenException('Management denied.');
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Resource belongs to another organization.');
    }
  }
}
