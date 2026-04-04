import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationStatus, Role } from '@prisma/client';
import { SubmitIdentityDto } from './dto/submit-identity.dto';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async submitIdentity(userId: string, dto: SubmitIdentityDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let organizationId = dto.organizationId || user.organizationId;

    // Fallback: if user has no org yet, use the first org in the system (or create one)
    if (!organizationId) {
      let defaultOrg = await this.prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' }
      });
      
      if (!defaultOrg) {
        // Auto-create a default institution if none exists
        defaultOrg = await this.prisma.organization.create({
          data: {
            name: 'Default Institution',
            slug: 'default-institution',
            type: 'UNIVERSITY',
            isActive: true
          }
        });
      }
      
      organizationId = defaultOrg.id;

      // Assign user to this org so future calls work
      await this.prisma.user.update({
        where: { id: userId },
        data: { organizationId }
      });
    }

    // Check if identity already exists for this user
    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: { userId }
    });

    if (existingIdentity) {
      if (existingIdentity.status === VerificationStatus.VERIFIED) {
        throw new BadRequestException('Identity is already verified.');
      }
      
      // Update existing
      return this.prisma.userIdentity.update({
        where: { userId },
        data: {
          idType: dto.idType,
          idNumber: dto.idNumber,
          documentUrl: dto.documentUrl,
          status: VerificationStatus.PENDING,
          organizationId
        }
      });
    }

    // Create new identity and update user status
    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.userIdentity.create({
        data: {
          userId,
          idType: dto.idType,
          idNumber: dto.idNumber,
          documentUrl: dto.documentUrl,
          status: VerificationStatus.PENDING,
          organizationId
        }
      });

      await tx.user.update({
        where: { id: userId },
        data: { verificationStatus: VerificationStatus.PENDING }
      });

      return identity;
    });
  }

  async getMyIdentity(userId: string) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { userId }
    });
    if (!identity) return { status: VerificationStatus.NOT_SUBMITTED };
    return identity;
  }

  async verifyIdentity(identityId: string, verifierId: string, status: VerificationStatus, rejectionReason?: string) {
    if (status !== VerificationStatus.VERIFIED && status !== VerificationStatus.REJECTED) {
      throw new BadRequestException('Invalid verification status transition.');
    }

    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.userIdentity.update({
        where: { id: identityId },
        data: {
          status,
          verifiedById: verifierId,
          verifiedAt: new Date(),
          rejectionReason: status === VerificationStatus.REJECTED ? rejectionReason : null
        }
      });

      await tx.user.update({
        where: { id: identity.userId },
        data: { verificationStatus: status }
      });

      return identity;
    });
  }

  async findAllPending(organizationId: string) {
    return this.prisma.userIdentity.findMany({
      where: { 
        organizationId,
        status: VerificationStatus.PENDING 
      },
      include: { user: true }
    });
  }
}
