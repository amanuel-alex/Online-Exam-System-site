import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, currentUser: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Role hierarchy checking: org_admin cannot create system_admin
    if (currentUser.role === Role.ORG_ADMIN) {
      if (createUserDto.role === Role.SYSTEM_ADMIN || createUserDto.role === Role.ORG_ADMIN) {
        throw new ForbiddenException('You do not have permission to create a user with this role.');
      }
      // Force org_admin to only create users in their org
      createUserDto.organizationId = currentUser.organizationId;
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.passwordHash, salt);

    const newUser = await this.prisma.user.create({
      data: {
        ...createUserDto,
        passwordHash: hashedPassword,
      },
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: CREATE_USER, Target: newUser.id, Actor: currentUser.id
    return newUser;
  }

  async findAll(queryDto: UsersQueryDto, currentUser: any) {
    const { page = 1, limit = 10, search, organizationId, role } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    // Organization scoping
    if (currentUser.role !== Role.SYSTEM_ADMIN) {
      where.organizationId = currentUser.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (role) {
      where.role = role as Role;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: this.getUserSelect(),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, currentUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.getUserSelect(),
    });
    
    if (!user) throw new NotFoundException('User not found');

    if (
      currentUser && 
      currentUser.role !== Role.SYSTEM_ADMIN && 
      user.organizationId !== currentUser.organizationId
    ) {
      throw new ForbiddenException("You cannot access this user's details");
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: any) {
    await this.findOne(id, currentUser); // Will throw if not found or no access

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: UPDATE_USER, Target: id, Actor: currentUser.id
    return updatedUser;
  }

  async assignRole(id: string, assignRoleDto: AssignRoleDto, currentUser: any) {
    await this.findOne(id, currentUser); // Ensure access

    if (currentUser.role === Role.ORG_ADMIN && (assignRoleDto.role === Role.SYSTEM_ADMIN || assignRoleDto.role === Role.ORG_ADMIN)) {
       throw new ForbiddenException('Cannot assign admin roles');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: assignRoleDto.role },
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: ASSIGN_ROLE, Target: id, Details: assignRoleDto.role
    return updatedUser;
  }

  async deactivate(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: DEACTIVATE_USER, Target: id
    return user;
  }
  
  async activate(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: ACTIVATE_USER, Target: id
    return user;
  }

  private getUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
