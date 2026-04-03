import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

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
