import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddUserToOrgDto } from './dto/add-user-to-org.dto';
import { OrgQueryDto } from './dto/org-query.dto';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) { }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(createDto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: createDto.slug },
    });
    if (existing) {
      throw new ConflictException(`Slug "${createDto.slug}" is already taken.`);
    }

    const org = await this.prisma.organization.create({
      data: {
        name: createDto.name,
        slug: createDto.slug,
        type: createDto.type,
        settings: createDto.settings as Prisma.InputJsonValue ?? Prisma.JsonNull,
        metadata: createDto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        region: createDto.region,
      },
    });

    // TODO: Audit Log -> Action: CREATE_ORGANIZATION, Target: org.id
    return org;
  }

  // ─────────────────────────────────────────────
  // READ — paginated list
  // ─────────────────────────────────────────────

  async findAll(queryDto: OrgQueryDto, currentUser: any) {
    const { page = 1, limit = 20, search, type, isActive } = queryDto;
    const skip = (page - 1) * limit;

    // org_admin can only see their own organization
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      const org = await this.prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
      });
      if (!org) throw new NotFoundException('Your organization was not found.');
      return { data: [org], meta: { total: 1, page: 1, limit, totalPages: 1 } };
    }

    const where: Prisma.OrganizationWhereInput = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, exams: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────
  // READ — single org with full counts
  // ─────────────────────────────────────────────

  async findOne(id: string, currentUser: any) {
    this.assertOrgAccess(id, currentUser);

    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, exams: true, questions: true } },
      },
    });

    if (!org) throw new NotFoundException('Organization not found.');
    return org;
  }

  // ─────────────────────────────────────────────
  // UPDATE (includes soft-delete via isActive)
  // ─────────────────────────────────────────────

  async update(id: string, updateDto: UpdateOrganizationDto, currentUser: any) {
    this.assertOrgAccess(id, currentUser);

    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found.');

    // Guard: only SYSTEM_ADMIN can deactivate (soft-delete) an organization
    if (typeof updateDto.isActive === 'boolean' && currentUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only System Admins can activate or deactivate organizations.');
    }

    // Guard: slug uniqueness
    if (updateDto.slug && updateDto.slug !== org.slug) {
      const slugTaken = await this.prisma.organization.findUnique({ where: { slug: updateDto.slug } });
      if (slugTaken) throw new ConflictException('Slug is already in use by another organization.');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.slug && { slug: updateDto.slug }),
        ...(updateDto.type && { type: updateDto.type }),
        ...(typeof updateDto.isActive === 'boolean' && { isActive: updateDto.isActive }),
        ...(updateDto.settings !== undefined && { settings: updateDto.settings as Prisma.InputJsonValue }),
        ...(updateDto.metadata !== undefined && { metadata: updateDto.metadata as Prisma.InputJsonValue }),
        ...(updateDto.region && { region: updateDto.region }),
      },
    });

    // TODO: Audit Log -> Action: UPDATE_ORGANIZATION, Target: id, Actor: currentUser.id
    return updated;
  }

  // ─────────────────────────────────────────────
  // USER MEMBERSHIP — Add
  // ─────────────────────────────────────────────

  async addUser(orgId: string, dto: AddUserToOrgDto, currentUser: any) {
    this.assertOrgAccess(orgId, currentUser);

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found.');
    if (!org.isActive) throw new BadRequestException('Cannot add users to an inactive organization.');

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.role === Role.SYSTEM_ADMIN) {
      throw new BadRequestException('System Admins cannot be assigned to an organization.');
    }
    if (user.organizationId === orgId) {
      throw new ConflictException('User is already a member of this organization.');
    }

    const updated = await this.prisma.user.update({
      where: { id: dto.userId },
      data: { organizationId: orgId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
    });

    // TODO: Audit Log -> Action: ADD_USER_TO_ORG, Target: orgId, UserId: dto.userId
    return updated;
  }

  // ─────────────────────────────────────────────
  // USER MEMBERSHIP — Remove
  // ─────────────────────────────────────────────

  async removeUser(orgId: string, userId: string, currentUser: any) {
    this.assertOrgAccess(orgId, currentUser);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.organizationId !== orgId) {
      throw new BadRequestException('This user does not belong to the specified organization.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId: null },
      select: { id: true, email: true, organizationId: true },
    });

    // TODO: Audit Log -> Action: REMOVE_USER_FROM_ORG, Target: orgId, UserId: userId
    return updated;
  }

  // ─────────────────────────────────────────────
  // USER MEMBERSHIP — List
  // ─────────────────────────────────────────────

  async getUsers(orgId: string, currentUser: any) {
    this.assertOrgAccess(orgId, currentUser);

    return this.prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────
  // SETTINGS — get only
  // ─────────────────────────────────────────────

  async getSettings(orgId: string, currentUser: any) {
    this.assertOrgAccess(orgId, currentUser);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, type: true, settings: true },
    });
    if (!org) throw new NotFoundException('Organization not found.');
    return org;
  }

  // ─────────────────────────────────────────────
  // GUARD HELPER — Multi-tenancy gate
  // ─────────────────────────────────────────────

  private assertOrgAccess(targetOrgId: string, currentUser: any): void {
    if (currentUser.role === Role.SYSTEM_ADMIN) return; // full access

    if (!currentUser.organizationId) {
      throw new ForbiddenException('You do not belong to any organization.');
    }

    if (currentUser.organizationId !== targetOrgId) {
      throw new ForbiddenException('You do not have access to this organization.');
    }
  }
}
