import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';
import { Role } from '@prisma/client';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * National Forensic Journaling (Legal Proof)
   * 
   * Captures Who, What, Where, and When with an anti-tamper Cryptographic Digital Signature.
   * Ensuring that any direct database modification to logs can be detected via hash-mismatch.
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
    requestInfo?: { ip?: string; userAgent?: string },
  ) {
    const timestamp = new Date();
    
    // Legal Integrity Signature (Anti-Tamper)
    const secret = process.env.AUDIT_SECRET || 'EXAMINA_FORENSIC_KEY';
    const hashPayload = `${action}:${userId}:${organizationId}:${timestamp.getTime()}:${secret}`;
    const entryHash = createHash('sha256').update(hashPayload).digest('hex');

    try {
      return await this.prisma.auditLog.create({
        data: {
          action,
          userId,
          organizationId,
          resourceType,
          resourceId,
          originalValue: originalValue || null,
          newValue: newValue || null,
          metadata: metadata || {},
          userIp: requestInfo?.ip,
          userAgent: requestInfo?.userAgent,
          entryHash,
          timestamp,
        },
      });
    } catch (err) {
      this.logger.error(`Forensic logging failed: ${err.message}`);
    }
  }

  /**
   * Forensic Retrieval with Multi-Tenant Scoping
   */
  async findAll(query: any, currentUser: any) {
    const { 
      page = 1, 
      limit = 10, 
      action, 
      resourceType, 
      resourceId, 
      userId, 
      organizationId,
      startDate,
      endDate
    } = query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    // Hierarchical Access Control
    // System Admins can see everything or filter by org.
    // Org Admins are strictly locked to their own organization's logs.
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      where.organizationId = currentUser.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: skip,
        take: Number(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Compliance Validation
   */
  async verifyIntegrity(logId: string): Promise<boolean> {
    const log = await this.prisma.auditLog.findUnique({ where: { id: logId } });
    if (!log) return false;

    const secret = process.env.AUDIT_SECRET || 'EXAMINA_FORENSIC_KEY';
    const expected = createHash('sha256')
      .update(`${log.action}:${log.userId}:${log.organizationId}:${log.timestamp.getTime()}:${secret}`)
      .digest('hex');
    
    return log.entryHash === expected;
  }
}

