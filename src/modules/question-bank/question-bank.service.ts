import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionBankCreateDto } from './dto/create-question.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { UpdateQuestionBankDto } from './dto/update-question.dto';
import { QuestionBankQueryDto } from './dto/question-query.dto';
import { Prisma, QuestionType, Role } from '@prisma/client';

@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(dto: QuestionBankCreateDto, currentUser: any) {
    this.assertCanManageQuestions(currentUser);

    const organizationId = this.resolveOrganizationId(dto.organizationId, currentUser);

    this.validateQuestionOptions(dto);

    return this.prisma.question.create({
      data: {
        organizationId,
        createdById: currentUser.id,
        type: dto.type,
        text: dto.text,
        points: dto.points ?? 1.0,
        difficulty: dto.difficulty,
        subject: dto.subject,
        topic: dto.topic,
        tags: dto.tags ?? [],
        duration: dto.duration,
        explanation: dto.explanation,
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
  }

  // ─────────────────────────────────────────────
  // BULK CREATE
  // ─────────────────────────────────────────────

  async createBulk(bulkDto: BulkCreateQuestionsDto, currentUser: any) {
    this.assertCanManageQuestions(currentUser);

    const results = await this.prisma.$transaction(async (tx) => {
      const createdQuestions = [];
      for (const dto of bulkDto.questions) {
        const organizationId = this.resolveOrganizationId(dto.organizationId, currentUser);
        this.validateQuestionOptions(dto);

        const q = await tx.question.create({
          data: {
            organizationId,
            createdById: currentUser.id,
            type: dto.type,
            text: dto.text,
            points: dto.points ?? 1.0,
            difficulty: dto.difficulty,
            subject: dto.subject,
            topic: dto.topic,
            tags: dto.tags ?? [],
            duration: dto.duration,
            explanation: dto.explanation,
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
        });
        createdQuestions.push(q);
      }
      return createdQuestions;
    });

    return {
      message: `${results.length} questions created successfully.`,
      count: results.length,
    };
  }

  // ─────────────────────────────────────────────
  // READ — List with Filters
  // ─────────────────────────────────────────────

  async findAll(query: QuestionBankQueryDto, currentUser: any) {
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

    // Multi-tenant scoping
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
    if (tag) {
      where.tags = { has: tag };
    }

    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
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
          _count: { select: { examQuestions: true } }
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
  // READ — Single
  // ─────────────────────────────────────────────

  async findOne(id: string, currentUser: any) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!question) throw new NotFoundException('Question not found.');
    this.assertOrgAccess(question.organizationId, currentUser);

    return question;
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  async update(id: string, dto: UpdateQuestionBankDto, currentUser: any) {
    const question = await this.findOne(id, currentUser);
    this.assertCanManageQuestions(currentUser);

    const mergedType = dto.type ?? question.type;
    const mergedOptions = dto.options !== undefined ? dto.options : undefined;

    // Validate type consistency if options/type updated
    if (mergedOptions !== undefined || dto.type) {
      this.validateQuestionOptions({ type: mergedType, options: mergedOptions } as any);
    }

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.points !== undefined && { points: dto.points }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.topic !== undefined && { topic: dto.topic }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.explanation !== undefined && { explanation: dto.explanation }),
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
      },
    });
  }

  // ─────────────────────────────────────────────
  // SOFT DELETE (Archive)
  // ─────────────────────────────────────────────

  async archive(id: string, currentUser: any) {
    await this.findOne(id, currentUser);
    this.assertCanManageQuestions(currentUser);

    return this.prisma.question.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async restore(id: string, currentUser: any) {
    const q = await this.prisma.question.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Question not found.');
    this.assertOrgAccess(q.organizationId, currentUser);
    this.assertCanManageQuestions(currentUser);

    return this.prisma.question.update({
      where: { id },
      data: { isArchived: false },
    });
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private resolveOrganizationId(dtoOrgId: string | undefined, currentUser: any): string {
    if (currentUser.role === Role.SYSTEM_ADMIN) {
      const orgId = dtoOrgId ?? currentUser.organizationId;
      if (!orgId) throw new BadRequestException('OrganizationId is required for System Admins.');
      return orgId;
    }
    return currentUser.organizationId;
  }

  private validateQuestionOptions(dto: Pick<QuestionBankCreateDto, 'type' | 'options'>) {
    const { type, options } = dto;
    if (type === QuestionType.MCQ || type === QuestionType.TRUE_FALSE) {
      if (!options || options.length < 2) {
        throw new BadRequestException(`${type} must have at least 2 options.`);
      }
      if (type === QuestionType.TRUE_FALSE && options.length !== 2) {
        throw new BadRequestException('True/False must have exactly 2 options.');
      }
      if (!options.some(o => o.isCorrect)) {
        throw new BadRequestException('At least one option must be correct.');
      }
    } else if (options && options.length > 0) {
      throw new BadRequestException(`${type} questions cannot have options.`);
    }
  }

  private assertCanManageQuestions(currentUser: any) {
    const allowed = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!allowed.includes(currentUser.role)) {
      throw new ForbiddenException('Insufficient permissions to manage question bank.');
    }
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) return;
    if (currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Access to this question is forbidden.');
    }
  }
}
