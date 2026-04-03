import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionQueryDto } from './dto/question-query.dto';
import { Prisma, QuestionType, Role } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(dto: CreateQuestionDto, currentUser: any) {
    this.assertCanManageQuestions(currentUser);

    // Resolve the target organization
    const organizationId =
      currentUser.role === Role.SYSTEM_ADMIN
        ? dto.organizationId ?? currentUser.organizationId
        : currentUser.organizationId;

    if (!organizationId) {
      throw new BadRequestException('organizationId is required for SYSTEM_ADMIN when not scoped to an org.');
    }

    // Validate options based on question type
    this.validateOptions(dto);

    const question = await this.prisma.question.create({
      data: {
        organizationId,
        createdById: currentUser.id,
        type: dto.type,
        text: dto.text,
        points: dto.points ?? 1.0,
        difficulty: dto.difficulty ?? 1,
        subject: dto.subject,
        topic: dto.topic,
        tags: dto.tags ?? [],
        ...(dto.options?.length && {
          options: {
            create: dto.options.map((opt, i) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              orderIndex: opt.orderIndex ?? i,
            })),
          },
        }),
      },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // TODO: Audit Log -> Action: CREATE_QUESTION, Target: question.id, Actor: currentUser.id
    return question;
  }

  // ─────────────────────────────────────────────
  // READ — paginated list with filters
  // ─────────────────────────────────────────────

  async findAll(query: QuestionQueryDto, currentUser: any) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      difficulty,
      subject,
      topic,
      tag,
      isArchived = false,
      organizationId,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.QuestionWhereInput = { isArchived };

    // Multi-tenancy scoping — non-admins only see their org's question bank
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      where.organizationId = currentUser.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;

    if (subject) {
      where.subject = { contains: subject, mode: 'insensitive' };
    }
    if (topic) {
      where.topic = { contains: topic, mode: 'insensitive' };
    }

    // Tag filter — exact match on the array field
    if (tag) {
      where.tags = { has: tag };
    }

    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          options: { orderBy: { orderIndex: 'asc' } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { answers: true, examQuestions: true } },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data: questions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─────────────────────────────────────────────
  // READ — single question with full options
  // ─────────────────────────────────────────────

  async findOne(id: string, currentUser: any) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { answers: true, examQuestions: true } },
      },
    });

    if (!question) throw new NotFoundException('Question not found.');
    this.assertOrgAccess(question.organizationId, currentUser);

    return question;
  }

  // ─────────────────────────────────────────────
  // UPDATE — replaces options when provided
  // ─────────────────────────────────────────────

  async update(id: string, dto: UpdateQuestionDto, currentUser: any) {
    const question = await this.findOne(id, currentUser);
    this.assertCanManageQuestions(currentUser);

    // Validate options against the final merged type
    const mergedType = dto.type ?? question.type;
    const mergedOptions = dto.options !== undefined ? dto.options : undefined;
    if (mergedOptions !== undefined || dto.type) {
      this.validateOptions({ type: mergedType, options: mergedOptions } as any);
    }

    const updated = await this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.points !== undefined && { points: dto.points }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.topic !== undefined && { topic: dto.topic }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        // Full option replacement: delete old, create new
        ...(dto.options !== undefined && {
          options: {
            deleteMany: {},
            create: dto.options.map((opt, i) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              orderIndex: opt.orderIndex ?? i,
            })),
          },
        }),
      },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // TODO: Audit Log -> Action: UPDATE_QUESTION, Target: id, Actor: currentUser.id
    return updated;
  }

  // ─────────────────────────────────────────────
  // ARCHIVE (soft-delete)
  // ─────────────────────────────────────────────

  async archive(id: string, currentUser: any) {
    await this.findOne(id, currentUser);
    this.assertCanManageQuestions(currentUser);

    return this.prisma.question.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  // ─────────────────────────────────────────────
  // RESTORE from archive
  // ─────────────────────────────────────────────

  async restore(id: string, currentUser: any) {
    // Fetch regardless of isArchived status
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question not found.');

    this.assertOrgAccess(question.organizationId, currentUser);
    this.assertCanManageQuestions(currentUser);

    return this.prisma.question.update({
      where: { id },
      data: { isArchived: false },
    });
  }

  // ─────────────────────────────────────────────
  // DELETE (hard — SYSTEM_ADMIN only)
  // ─────────────────────────────────────────────

  async remove(id: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only System Admins can permanently delete questions.');
    }

    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question not found.');

    await this.prisma.question.delete({ where: { id } });

    // TODO: Audit Log -> Action: DELETE_QUESTION, Target: id, Actor: currentUser.id
    return { message: 'Question permanently deleted.' };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  /**
   * Enforces option rules per question type:
   *   - MCQ: ≥ 2 options, at least 1 correct
   *   - TRUE_FALSE: exactly 2 options, at least 1 correct
   *   - ESSAY / FILE_UPLOAD: must NOT have options
   */
  private validateOptions(dto: Pick<CreateQuestionDto, 'type' | 'options'>): void {
    const { type, options } = dto;

    if (type === QuestionType.MCQ || type === QuestionType.TRUE_FALSE) {
      if (!options || options.length < 2) {
        throw new BadRequestException(
          `${type} questions require at least 2 options.`,
        );
      }

      if (type === QuestionType.TRUE_FALSE && options.length !== 2) {
        throw new BadRequestException(
          'TRUE_FALSE questions must have exactly 2 options.',
        );
      }

      const hasCorrect = options.some(o => o.isCorrect);
      if (!hasCorrect) {
        throw new BadRequestException(
          'At least one option must be marked as correct.',
        );
      }
    } else if (options && options.length > 0) {
      throw new BadRequestException(
        `${type} questions must not include options.`,
      );
    }
  }

  /** Only teachers, examiners, org admins, and system admins can write questions */
  private assertCanManageQuestions(currentUser: any): void {
    const allowed: Role[] = [
      Role.SYSTEM_ADMIN,
      Role.ORG_ADMIN,
      Role.TEACHER,
      Role.EXAMINER,
    ];
    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('You do not have permission to manage questions.');
    }
  }

  /** Ensures a non-admin user only accesses their own organization's questions */
  private assertOrgAccess(orgId: string, currentUser: any): void {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (currentUser.organizationId !== orgId) {
      throw new ForbiddenException('You do not have access to this question.');
    }
  }
}
