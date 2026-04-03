import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enterprise-Grade Forensic Logging
   * 
   * Captures the 'Who, What, Where, and Before/After' of every critical mutation.
   */
  async log(
    action: string,
    userId: string,
    organizationId: string,
    resourceType?: string,
    resourceId?: string,
    originalValue?: any,
    newValue?: any,
    metadata?: any,
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        userId,
        organizationId,
        resourceType,
        resourceId,
        originalValue: originalValue || null,
        newValue: newValue || null,
        metadata: metadata || {},
        timestamp: new Date(),
      },
    });
  }

  /**
   * System-Level Querying for Compliance 
   */
  async findByResource(type: string, id: string) {
    return this.prisma.auditLog.findMany({
      where: { resourceType: type, resourceId: id },
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
  }

  async findByOrganization(orgId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}
