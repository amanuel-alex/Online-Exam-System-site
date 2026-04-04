import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionBankCreateDto } from './dto/create-question.dto';
import { UpdateQuestionBankDto } from './dto/update-question.dto';
import { Role } from '@prisma/client';

/**
 * National-Scale Question Bank Service
 * 
 * Enforces strict multi-tenant isolation via the Prisma TenantClient extension.
 * Any developer error in logic is caught by the database-layer filter, 
 * ensuring no student or teacher can access cross-org questions.
 */
@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: QuestionBankCreateDto, currentUser: any) {
    const tenant = this.prisma.tenantClient(currentUser.organizationId);

    return tenant.question.create({
      data: {
        organizationId: currentUser.organizationId,
        createdById: currentUser.id,
        subject: dto.subject,
        topic: dto.topic,
        difficulty: dto.difficulty as any,
        versions: {
          create: {
            versionNumber: 1,
            type: dto.type,
            text: dto.text,
            points: dto.points,
            explanation: dto.explanation,
            createdById: currentUser.id,
            options: {
              create: dto.options?.map((opt, index) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                orderIndex: index,
              })) ?? [],
            },
          },
        },
      },
    });
  }

  async createBulk(dto: any, currentUser: any) {
    // TODO: Implement bulk creation logic
    return { count: 0 };
  }

  async findAll(query: any, currentUser: any) {
    const tenant = this.prisma.tenantClient(currentUser.organizationId);
    
    return tenant.question.findMany({
      include: { 
        versions: { 
          orderBy: { versionNumber: 'desc' }, 
          take: 1 
        } 
      },
    });
  }

  async findOne(id: string, currentUser: any) {
    const tenant = this.prisma.tenantClient(currentUser.organizationId);
    
    const question = await tenant.question.findUnique({
      where: { id },
      include: { versions: { include: { options: true } } },
    });

    if (!question) throw new NotFoundException('Question not found or access denied.');
    return question;
  }

  async update(id: string, dto: UpdateQuestionBankDto, currentUser: any) {
    // TODO: Implement update logic
    return this.findOne(id, currentUser);
  }

  async archive(id: string, currentUser: any) {
    // TODO: Implement archive logic
    return this.deleteQuestion(id, currentUser);
  }

  async restore(id: string, currentUser: any) {
    // TODO: Implement restore logic
    const tenant = this.prisma.tenantClient(currentUser.organizationId);
    return tenant.question.update({
      where: { id },
      data: { isArchived: false } as any, // fallback if needed
    });
  }

  async deleteQuestion(id: string, currentUser: any) {
    const tenant = this.prisma.tenantClient(currentUser.organizationId);

    // This performs a soft-delete (Sets deletedAt = now) due to the Tenant Filter
    return tenant.question.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
