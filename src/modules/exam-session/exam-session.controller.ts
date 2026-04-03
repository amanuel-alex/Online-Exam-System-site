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
} from '@nestjs/common';
import { ExamSessionService } from './exam-session.service';
import { CreateExamSessionDto } from './dto/create-session.dto';
import { AssignUserToSessionDto } from './dto/assign-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MultiTenantGuard } from '../../common/guards/multi-tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, SessionStatus } from '@prisma/client';

@Controller('exam-sessions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, MultiTenantGuard)
export class ExamSessionController {
  constructor(private readonly sessionService: ExamSessionService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('create:exam')
  create(@Body() dto: CreateExamSessionDto, @CurrentUser() currentUser: any) {
    return this.sessionService.create(dto, currentUser);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:exam')
  findAll(@Query() query: any, @CurrentUser() currentUser: any) {
    return this.sessionService.findAll(query, currentUser);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:exam')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.sessionService.findOne(id, currentUser);
  }

  @Post(':id/assign')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  assignUsers(
    @Param('id') id: string,
    @Body() dto: AssignUserToSessionDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.sessionService.assignUsers(id, dto, currentUser);
  }

  @Get(':id/validate')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  validate(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.sessionService.validateSessionAccess(id, currentUser);
  }
}
