import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OrganizationConfigService } from './organization-config.service';
import { UpdateOrgConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MultiTenantGuard } from '../../common/guards/multi-tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('organizations/:id/config')
@UseGuards(JwtAuthGuard, RolesGuard, MultiTenantGuard)
export class OrganizationConfigController {
  constructor(private readonly configService: OrganizationConfigService) {}

  @Get()
  @Roles(Role.ORG_ADMIN, Role.SYSTEM_ADMIN, Role.TEACHER, Role.EXAMINER)
  getConfig(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.configService.getConfig(id, currentUser);
  }

  @Patch()
  @Roles(Role.ORG_ADMIN, Role.SYSTEM_ADMIN)
  updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateOrgConfigDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.configService.updateConfig(id, dto, currentUser);
  }
}
