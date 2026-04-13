import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('create:user')
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() currentUser: any) {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN) 
  @Permissions('read:user')
  findAll(@Query() query: UsersQueryDto, @CurrentUser() currentUser: any) {
    return this.usersService.findAll(query, currentUser);
  }

  @Get('me')
  getProfile(@CurrentUser() currentUser: any) {
    return this.usersService.findOne(currentUser.id, currentUser);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER)
  @Permissions('read:user')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.findOne(id, currentUser);
  }

  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('update:user')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @CurrentUser() currentUser: any) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Put(':id/role')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('assign:role')
  assignRole(@Param('id') id: string, @Body() assignRoleDto: AssignRoleDto, @CurrentUser() currentUser: any) {
    return this.usersService.assignRole(id, assignRoleDto, currentUser);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('update:user')
  deactivate(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deactivate(id, currentUser);
  }

  @Patch('me/password')
  changeMyPassword(@Body() changePasswordDto: any, @CurrentUser() currentUser: any) {
    return this.usersService.changePassword(currentUser.id, changePasswordDto);
  }

  @Post('bulk-import')
  @Roles(Role.ORG_ADMIN) 
  bulkImport(@Body('csvContent') csvContent: string, @CurrentUser() currentUser: any) {
    return this.usersService.bulkImportStudents(currentUser.organizationId, csvContent);
  }

  @Patch(':id/activate')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('update:user')
  activate(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.activate(id, currentUser);
  }
}
