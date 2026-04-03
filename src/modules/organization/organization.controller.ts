import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddUserToOrgDto } from './dto/add-user-to-org.dto';
import { OrgQueryDto } from './dto/org-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { MultiTenantGuard } from '../../common/guards/multi-tenant.guard';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, MultiTenantGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ─────────────────────────────────────────────
  // POST /organizations — Create a new org
  // Only system_admin
  // ─────────────────────────────────────────────
  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  create(@Body() createDto: CreateOrganizationDto, @CurrentUser() currentUser: any) {
    return this.orgService.create(createDto);
  }

  // ─────────────────────────────────────────────
  // GET /organizations — Paginated list
  // system_admin: all orgs | org_admin: own only
  // ─────────────────────────────────────────────
  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  findAll(@Query() query: OrgQueryDto, @CurrentUser() currentUser: any) {
    return this.orgService.findAll(query, currentUser);
  }

  // ─────────────────────────────────────────────
  // GET /organizations/:id — Org detail
  // ─────────────────────────────────────────────
  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.orgService.findOne(id, currentUser);
  }

  // ─────────────────────────────────────────────
  // PUT /organizations/:id — Update org / soft-delete via isActive
  // ─────────────────────────────────────────────
  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('organization:user:manage')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrganizationDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.orgService.update(id, updateDto, currentUser);
  }

  // ─────────────────────────────────────────────
  // GET /organizations/:id/settings — Fetch settings
  // ─────────────────────────────────────────────
  @Get(':id/settings')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  getSettings(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.orgService.getSettings(id, currentUser);
  }

  // ─────────────────────────────────────────────
  // GET /organizations/:id/users — List org members
  // ─────────────────────────────────────────────
  @Get(':id/users')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('read:user')
  getUsers(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.orgService.getUsers(id, currentUser);
  }

  // ─────────────────────────────────────────────
  // POST /organizations/:id/users — Add existing user to org
  // ─────────────────────────────────────────────
  @Post(':id/users')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('organization:user:manage')
  addUser(
    @Param('id') id: string,
    @Body() dto: AddUserToOrgDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.orgService.addUser(id, dto, currentUser);
  }

  // ─────────────────────────────────────────────
  // DELETE /organizations/:id/users/:userId — Remove user from org
  // ─────────────────────────────────────────────
  @Delete(':id/users/:userId')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  @Permissions('organization:user:manage')
  @HttpCode(HttpStatus.OK)
  removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.orgService.removeUser(id, userId, currentUser);
  }
}
