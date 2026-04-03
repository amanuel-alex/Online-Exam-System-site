import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddUserToOrgDto } from './dto/add-user-to-org.dto';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateOrganizationDto, currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only System Admins can create organizations.');
    }

    const existing = await this.prisma.organization.findUnique({
      where: { slug: createDto.slug },
    });
    if (existing) {
      throw new ConflictException('Organization with this slug already exists.');
    }

    return this.prisma.organization.create({
      data: createDto,
    });
  }

  async findAll(currentUser: any) {
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      // If not system admin, they can only "find" their own organization
      return this.prisma.organization.findMany({
        where: { id: currentUser.organizationId },
      });
    }

    return this.prisma.organization.findMany();
  }

  async findOne(id: string, currentUser: any) {
    this.checkOrgAccess(id, currentUser);

    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, exams: true, questions: true },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, updateDto: UpdateOrganizationDto, currentUser: any) {
    this.checkOrgAccess(id, currentUser);

    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    if (updateDto.slug && updateDto.slug !== org.slug) {
      const existing = await this.prisma.organization.findUnique({ where: { slug: updateDto.slug } });
      if (existing) {
        throw new ConflictException('Slug is already in use by another organization');
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: updateDto,
    });
  }

  async addUserToOrganization(id: string, dto: AddUserToOrgDto, currentUser: any) {
    this.checkOrgAccess(id, currentUser);

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SYSTEM_ADMIN) {
      throw new BadRequestException('Cannot assign a system admin to an organization.');
    }

    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { organizationId: id },
      select: { id: true, email: true, organizationId: true, role: true },
    });
  }

  async getUsersInOrganization(id: string, currentUser: any) {
    this.checkOrgAccess(id, currentUser);

    return this.prisma.user.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  private checkOrgAccess(targetOrgId: string, currentUser: any) {
    if (currentUser.role === Role.SYSTEM_ADMIN) {
      return; // Allowed
    }
    
    if (!currentUser.organizationId) {
      throw new ForbiddenException('You do not belong to any organization.');
    }

    if (currentUser.organizationId !== targetOrgId) {
      throw new ForbiddenException('You do not have access to this organization.');
    }
  }
}
