import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrgConfigDto } from './dto/update-config.dto';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Default platform-wide settings (Fallback)
   */
  private readonly DEFAULTS = {
    grading: { system: 'PERCENTAGE', defaultPassMark: 50 },
    exams: { maxAttempts: 3, defaultDurationMinutes: 60, requireProctoring: false },
  };

  /**
   * Get merged configuration for an organization
   */
  async getConfig(organizationId: string, currentUser: any) {
    this.assertOrgAccess(organizationId, currentUser);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org) throw new NotFoundException('Organization not found.');

    // Merge custom settings with platform defaults
    const settings = (org.settings as any) || {};

    return {
      grading: { ...this.DEFAULTS.grading, ...(settings.grading || {}) },
      exams: { ...this.DEFAULTS.exams, ...(settings.exams || {}) },
    };
  }

  /**
   * Update configuration for an organization
   */
  async updateConfig(organizationId: string, dto: UpdateOrgConfigDto, currentUser: any) {
    this.assertCanManageConfig(currentUser);
    this.assertOrgAccess(organizationId, currentUser);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) throw new NotFoundException('Organization not found.');

    // Deep merge logic (Partial)
    const existingSettings = (org.settings as any) || {};
    const newSettings = {
      grading: { ...(existingSettings.grading || {}), ...(dto.grading || {}) },
      exams: { ...(existingSettings.exams || {}), ...(dto.exams || {}) },
    };

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: newSettings as any },
    });
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private assertCanManageConfig(currentUser: any) {
    if (currentUser.role !== Role.ORG_ADMIN && currentUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('Configuration management denied.');
    }
  }

  private assertOrgAccess(orgId: string, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN && currentUser.organizationId !== orgId) {
      throw new ForbiddenException('Resource belongs to another organization.');
    }
  }
}
