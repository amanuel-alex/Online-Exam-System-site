import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { parse } from 'csv-parse/sync';

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
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const newUser = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
        studentId: createUserDto.studentId,
        organizationId: createUserDto.organizationId,
        isActive: createUserDto.isActive ?? true,
        isFirstLogin: true,
      } as any,
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: CREATE_USER, Target: newUser.id, Actor: currentUser.id
    return newUser;
  }

  async bulkImportStudents(organizationId: string, csvContent: string) {
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true 
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (const record of records as any[]) {
      try {
        const { name, email, studentId } = record;
        if (!name || !email) {
          throw new Error('Name and email are required');
        }

        // Split name into first and last
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'Student';

        // Check unique email system-wide
        const existingEmail = await this.prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
          throw new Error(`Email ${email} already exists`);
        }

        // Default password (e.g., studentId or a random one)
        const password = studentId || 'ChangeMe123!';
        const hashedPassword = await bcrypt.hash(password, 10);

        await this.prisma.user.create({
          data: {
            email,
            passwordHash: hashedPassword,
            firstName,
            lastName,
            studentId,
            role: Role.STUDENT,
            organizationId,
            isFirstLogin: true,
            verificationStatus: 'NOT_SUBMITTED',
            isActive: true
          } as any
        });

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ record, message: err.message });
      }
    }

    return results;
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
      where: { id: id },
      data: { isActive: true },
      select: this.getUserSelect(),
    });

    // TODO: Audit Log -> Action: ACTIVATE_USER, Target: id
    return user;
  }

  async changePassword(id: string, changePasswordDto: any) {
    const { newPassword } = changePasswordDto;
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        isFirstLogin: false,
      } as any,
      select: this.getUserSelect(),
    });
  }

  private getUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      verificationStatus: true,
      isActive: true,
      isFirstLogin: true,
      studentId: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
