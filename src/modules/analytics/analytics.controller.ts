import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MultiTenantGuard } from '../../common/guards/multi-tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, MultiTenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('exam/:id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  getExamAnalytics(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.analyticsService.getExamAnalytics(id, currentUser);
  }

  @Get('org')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  getOrgAnalytics(@Query('organizationId') orgId: string, @CurrentUser() currentUser: any) {
    return this.analyticsService.getOrgAnalytics(currentUser, orgId);
  }

  @Get('student/:studentId')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.STUDENT)
  getStudentPerformance(@Param('studentId') studentId: string, @CurrentUser() currentUser: any) {
    return this.analyticsService.getStudentPerformance(studentId, currentUser);
  }

  @Get('me')
  @Roles(Role.STUDENT)
  getMyPerformance(@CurrentUser() currentUser: any) {
    return this.analyticsService.getStudentPerformance(currentUser.id, currentUser);
  }
}
