import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamSessionDto } from './dto/create-session.dto';
import { AssignUserToSessionDto } from './assign-user.dto';
import { Prisma, Role, SessionStatus } from '@prisma/client';

@Injectable()
export class ExamSessionService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(dto: CreateExamSessionDto, currentUser: any) {
    this.assertCanManageSessions(currentUser);

    const organizationId = this.resolveOrganizationId(dto.organizationId, currentUser);

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Session start time must be before end time.');
    }

    // Ensure Exam exists and belongs to the same org
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
    });

    if (!exam) throw new NotFoundException('Exam not found.');
    if (exam.organizationId !== organizationId) {
      throw new ForbiddenException('Exam belongs to another organization.');
    }

    return this.prisma.examSession.create({
      data: {
        organizationId,
        createdById: currentUser.id,
        examId: dto.examId,
        title: dto.title,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isPublic: dto.isPublic,
        status: dto.status,
      },
    });
  }

  // ─────────────────────────────────────────────
  // ASSIGN USERS (PRIVATE SESSION)
  // ─────────────────────────────────────────────

  async assignUsers(sessionId: string, dto: AssignUserToSessionDto, currentUser: any) {
    const session = await this.findOne(sessionId, currentUser);
    this.assertCanManageSessions(currentUser);

    // Atomic update of session users
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete existing (Optional - depend on strategy)
      // For now, we'll just add new ones or full overwrite
      await tx.sessionUser.deleteMany({ where: { sessionId } });

      // 2. Create new assignments
      return tx.sessionUser.createMany({
        data: dto.userIds.map((userId) => ({
          sessionId,
          userId,
        })),
      });
    });

    return { message: `Assigned ${dto.userIds.length} users successfully.` };
  }

  // ─────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────

  async findAll(query: any, currentUser: any) {
    const organizationId = this.resolveOrganizationId(query.organizationId, currentUser);

    const where: Prisma.ExamSessionWhereInput = {
      organizationId,
      ...(query.status && { status: query.status }),
      ...(query.examId && { examId: query.examId }),
    };

    // If student, only show public or assigned sessions
    if (currentUser.role === Role.STUDENT) {
      where.OR = [
        { isPublic: true },
        { sessionUsers: { some: { userId: currentUser.id } } },
      ];
    }

    return this.prisma.examSession.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        exam: { select: { title: true, durationMinutes: true } },
        _count: { select: { sessionUsers: true, attempts: true } },
      },
    });
  }

  async findOne(id: string, currentUser: any) {
    const session = await this.prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: { select: { title: true, passPercentage: true, durationMinutes: true } },
        sessionUsers: { include: { user: { select: { firstName: true, email: true } } } },
      },
    });

    if (!session) throw new NotFoundException('Session not found.');
    this.assertOrgAccess(session.organizationId, currentUser);

    return session;
  }

  // ─────────────────────────────────────────────
  // ACCESS VALIDATION (FOR STARTING EXAM)
  // ─────────────────────────────────────────────

  async validateSessionAccess(sessionId: string, currentUser: any) {
    const session = await this.findOne(sessionId, currentUser);

    // 1. Check time window
    const now = new Date();
    if (now < session.startTime) throw new ForbiddenException('Exam session has not started yet.');
    if (now > session.endTime) throw new ForbiddenException('Exam session has closed.');

    // 2. Check if user is eligible
    if (!session.isPublic) {
      const isAssigned = session.sessionUsers.some((su) => su.userId === currentUser.id);
      if (!isAssigned && currentUser.role === Role.STUDENT) {
        throw new ForbiddenException('You are not assigned to this private exam session.');
      }
    }

    // 3. Check session status
    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.SCHEDULED) {
      throw new ForbiddenException('Exam session is not in active state.');
    }

    return session;
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private resolveOrganizationId(dtoOrgId: string | undefined, currentUser: any): string {
    if (currentUser.role === Role.SYSTEM_ADMIN) {
      return dtoOrgId || currentUser.organizationId;
    }
    return currentUser.organizationId;
  }

  private assertCanManageSessions(currentUser: any) {
    const roles: Role[] = [Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER];
    if (!roles.includes(currentUser.role)) throw new ForbiddenException('Management denied.');
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Resource belongs to another organization.');
    }
  }
}
