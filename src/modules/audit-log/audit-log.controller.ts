import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MultiTenantGuard } from '../../common/guards/multi-tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, MultiTenantGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  findAll(@Query() query: any, @CurrentUser() currentUser: any) {
    return this.auditLogService.findAll(query, currentUser);
  }

  @Post('report')
  @Roles(Role.STUDENT, Role.TEACHER, Role.EXAMINER)
  reportSuspicious(@Body() metadata: any, @CurrentUser() currentUser: any) {
    // Allows reporting of suspicious activity (e.g. from a proctoring app)
    return this.auditLogService.log(
      'SUSPICIOUS_ACTIVITY_REPORT',
      currentUser.id,
      currentUser.organizationId,
      metadata
    );
  }
}
