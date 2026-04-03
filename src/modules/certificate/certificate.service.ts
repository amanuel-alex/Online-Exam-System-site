import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class CertificateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * National-Scale Certificate Issuance
   * 
   * Generates an immutable, cryptographically-verifiable certificate for a student.
   * Includes a unique publicly-shareable ID and an anti-forgery hash.
   */
  async issueCertificate(resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { attempt: { include: { student: true, exam: true } } },
    });

    if (!result || !result.isPassed) {
      throw new Error('Certificate can only be issued for passed results.');
    }

    // Anti-Forgery Checksum
    const secret = process.env.CERTIFICATE_SECRET || 'EXAMINA_CERT_SALT';
    const uniqueId = `EX-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const verificationPayload = `${result.studentId}:${result.totalScore}:${uniqueId}:${secret}`;
    const verificationHash = createHash('sha256').update(verificationPayload).digest('hex');

    return this.prisma.certificate.create({
      data: {
        uniqueId,
        resultId,
        userId: result.studentId,
        examId: result.attempt.examId,
        organizationId: result.organizationId,
        verificationHash,
      },
    });
  }

  /**
   * Public Verification API
   * 
   * Allows third-party entities (Recruiters, Universities) to validate 
   * a certificate's authenticity using only its Public Unique ID.
   */
  async publicVerify(uniqueId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { uniqueId },
      include: { 
        user: { select: { firstName: true, lastName: true } },
        exam: { select: { title: true } },
        result: { select: { totalScore: true, percentage: true, issuedAt: true } }
      },
    });

    if (!cert || cert.isRevoked) {
      throw new NotFoundException('Invalid or revoked certificate.');
    }

    return {
      status: 'VERIFIED',
      id: cert.uniqueId,
      issuedTo: `${cert.user.firstName} ${cert.user.lastName}`,
      exam: cert.exam.title,
      score: cert.result.percentage,
      issuedAt: cert.issuedAt,
      authenticityHash: cert.verificationHash, // Publicly shareable check
    };
  }
}
