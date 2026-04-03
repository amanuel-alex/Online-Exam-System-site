import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('create:user')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN) 
  @Permissions('read:user')
  findAll(@Query('organizationId') organizationId?: string) {
    return this.usersService.findAll(organizationId);
  }

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER)
  @Permissions('read:user')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id/role')
  @Roles(Role.SYSTEM_ADMIN)
  @Permissions('manage:roles')
  assignRole(@Param('id') id: string, @Body() assignRoleDto: AssignRoleDto) {
    return this.usersService.assignRole(id, assignRoleDto);
  }
}
