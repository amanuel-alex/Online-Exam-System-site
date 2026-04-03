import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradeManualAnswerDto } from './dto/grade-manual-answer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('grading')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post('auto/:attemptId')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  autoGrade(@Param('attemptId') attemptId: string) {
    return this.gradingService.autoGradeAttempt(attemptId);
  }

  @Post('manual/:attemptId')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  manualGrade(
    @Param('attemptId') attemptId: string,
    @Body() dto: GradeManualAnswerDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.gradingService.manualGrade(attemptId, dto, currentUser);
  }

  @Patch('release/:attemptId')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  releaseResult(@Param('attemptId') attemptId: string, @CurrentUser() currentUser: any) {
    return this.gradingService.releaseResult(attemptId, currentUser);
  }

  @Get('result/:attemptId')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ORG_ADMIN, Role.SYSTEM_ADMIN)
  @Permissions('read:exam')
  getResult(@Param('attemptId') attemptId: string) {
    return this.gradingService.finalizeResultIfComplete(attemptId);
  }
}
