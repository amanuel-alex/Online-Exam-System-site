import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core logging method.
   * Records an immutable entry in the audit trail.
   */
  async log(action: string, userId: string, organizationId: string, metadata?: any) {
    return this.prisma.auditLog.create({
      data: {
        action,
        userId,
        organizationId,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Fetch logs for a specific organization (Admin only)
   */
  async findAll(query: any, currentUser: any) {
    const organizationId = this.resolveOrganizationId(query.organizationId, currentUser);
    
    // Only ORG_ADMIN or SYSTEM_ADMIN can see logs
    if (currentUser.role === Role.STUDENT || currentUser.role === Role.TEACHER) {
      throw new ForbiddenException('You do not have permission to view audit logs.');
    }

    const where: any = { organizationId };
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit || 50,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } }
      }
    });
  }

  private resolveOrganizationId(dtoOrgId: string | undefined, currentUser: any): string {
    if (currentUser.role === Role.SYSTEM_ADMIN) return dtoOrgId || currentUser.organizationId;
    return currentUser.organizationId;
  }
}
