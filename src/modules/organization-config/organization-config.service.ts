import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrgConfigDto } from './dto/update-config.dto';
import { Role } from '@prisma/client';
import { ExaminaCacheService } from '../../common/cache/cache.service';

@Injectable()
export class OrganizationConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ExaminaCacheService,
  ) {}

  private readonly DEFAULTS = {
    grading: { system: 'PERCENTAGE', defaultPassMark: 50 },
    exams: { maxAttempts: 3, defaultDurationMinutes: 60, requireProctoring: false },
  };

  /**
   * Get merged configuration for an organization (Cached for 1 hour)
   */
  async getConfig(organizationId: string, currentUser: any) {
    this.assertOrgAccess(organizationId, currentUser);

    const cacheKey = `org:${organizationId}:config`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org) throw new NotFoundException('Organization not found.');

    const settings = (org.settings as any) || {};
    const config = {
      grading: { ...this.DEFAULTS.grading, ...(settings.grading || {}) },
      exams: { ...this.DEFAULTS.exams, ...(settings.exams || {}) },
    };

    // Cache the result for performance (1 hour)
    await this.cache.set(cacheKey, config, 3600);
    return config;
  }

  /**
   * Update configuration for an organization (Invalidates Cache)
   */
  async updateConfig(organizationId: string, dto: UpdateOrgConfigDto, currentUser: any) {
    this.assertCanManageConfig(currentUser);
    this.assertOrgAccess(organizationId, currentUser);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) throw new NotFoundException('Organization not found.');

    const existingSettings = (org.settings as any) || {};
    const newSettings = {
      grading: { ...(existingSettings.grading || {}), ...(dto.grading || {}) },
      exams: { ...(existingSettings.exams || {}), ...(dto.exams || {}) },
    };

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: newSettings as any },
    });

    // Invalidate the cache to ensure new requests see fresh data
    await this.cache.del(`org:${organizationId}:config`);

    return updated;
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
      throw new ForbiddenException('Unauthorized organization access.');
    }
  }
}
