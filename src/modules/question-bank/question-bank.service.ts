import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { Prisma, Role, QuestionType } from '@prisma/client';

@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CREATE (Initial Version)
  // ─────────────────────────────────────────────

  async create(dto: CreateQuestionDto, currentUser: any) {
    this.assertCanManageQuestions(currentUser);
    const organizationId = this.resolveOrganizationId(dto.organizationId, currentUser);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the Question Header
      const question = await tx.question.create({
        data: {
          organizationId,
          createdById: currentUser.id,
          subject: dto.subject,
          topic: dto.topic,
          difficulty: dto.difficulty,
          tags: dto.tags || [],
        },
      });

      // 2. Create the first Question Version
      const version = await tx.questionVersion.create({
        data: {
          questionId: question.id,
          versionNumber: 1,
          type: dto.type,
          text: dto.text,
          points: dto.points || 1,
          explanation: dto.explanation,
          createdById: currentUser.id,
          options: {
            create: dto.options?.map((opt, i) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              orderIndex: i,
            })),
          },
        },
      });

      // 3. Set as current version
      return tx.question.update({
        where: { id: question.id },
        data: { currentVersionId: version.id },
        include: { versions: { include: { options: true } } },
      });
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE (Creates New Version)
  // ─────────────────────────────────────────────

  async update(id: string, dto: any, currentUser: any) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!question) throw new NotFoundException('Question not found.');
    this.assertOrgAccess(question.organizationId, currentUser);

    const latestVersion = question.versions[0];

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Header metadata if provided
      if (dto.subject || dto.topic || dto.difficulty || dto.tags) {
        await tx.question.update({
          where: { id },
          data: {
            subject: dto.subject,
            topic: dto.topic,
            difficulty: dto.difficulty,
            tags: dto.tags,
          },
        });
      }

      // 2. Create a NEW Version
      const newVersion = await tx.questionVersion.create({
        data: {
          questionId: id,
          versionNumber: latestVersion.versionNumber + 1,
          type: dto.type || latestVersion.type,
          text: dto.text || latestVersion.text,
          points: dto.points ?? latestVersion.points,
          explanation: dto.explanation || latestVersion.explanation,
          createdById: currentUser.id,
          options: {
            create: (dto.options || []).map((opt, i) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              orderIndex: i,
            })),
          },
        },
      });

      // 3. Promote to current version
      return tx.question.update({
        where: { id },
        data: { currentVersionId: newVersion.id },
      });
    });
  }

  // ─────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────

  async findAll(query: any, currentUser: any) {
    const organizationId = this.resolveOrganizationId(query.organizationId, currentUser);
    const where: Prisma.QuestionWhereInput = {
      organizationId,
      isArchived: false,
      ...(query.subject && { subject: query.subject }),
      ...(query.topic && { topic: query.topic }),
    };

    return this.prisma.question.findMany({
      where,
      include: {
        versions: {
          where: { id: { equals: Prisma.at('currentVersionId') } as any }, // Logic placeholder for latest
          include: { options: true }
        }
      }
    });
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private resolveOrganizationId(dtoOrgId: string | undefined, currentUser: any): string {
    if (currentUser.role === Role.SYSTEM_ADMIN) return dtoOrgId || currentUser.organizationId;
    return currentUser.organizationId;
  }

  private assertCanManageQuestions(currentUser: any) {
    const roles: Role[] = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!roles.includes(currentUser.role)) throw new ForbiddenException('Question management denied.');
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Cross-organization access forbidden.');
    }
  }
}
