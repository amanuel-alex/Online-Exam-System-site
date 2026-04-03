import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddUserToOrgDto } from './dto/add-user-to-org.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  // Only System Admins can create new organizations
  create(@Body() createDto: CreateOrganizationDto, @CurrentUser() currentUser: any) {
    return this.orgService.create(createDto, currentUser);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN) 
  findAll(@CurrentUser() currentUser: any) {
    return this.orgService.findAll(currentUser);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.orgService.findOne(id, currentUser);
  }

  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('organization:user:manage') // Using the permission you explicitly requested
  update(@Param('id') id: string, @Body() updateDto: UpdateOrganizationDto, @CurrentUser() currentUser: any) {
    return this.orgService.update(id, updateDto, currentUser);
  }

  @Get(':id/users')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('read:user')
  getUsers(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.orgService.getUsersInOrganization(id, currentUser);
  }

  @Post(':id/users')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('organization:user:manage')
  addUser(@Param('id') id: string, @Body() dto: AddUserToOrgDto, @CurrentUser() currentUser: any) {
    return this.orgService.addUserToOrganization(id, dto, currentUser);
  }
}
