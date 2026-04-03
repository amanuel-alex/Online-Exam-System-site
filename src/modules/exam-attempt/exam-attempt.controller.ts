import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ExamAttemptService } from './exam-attempt.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAttemptAnswerDto } from './dto/save-answer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('exam-attempt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamAttemptController {
  constructor(private readonly examAttemptService: ExamAttemptService) {}

  @Post('start')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  startAttempt(@Body() dto: StartAttemptDto, @CurrentUser() currentUser: any) {
    return this.examAttemptService.startAttempt(dto, currentUser);
  }

  @Post(':id/save-answer')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  saveAnswer(
    @Param('id') attemptId: string,
    @Body() dto: SaveAttemptAnswerDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.examAttemptService.saveAnswer(attemptId, dto, currentUser);
  }

  @Post(':id/submit')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  submitAttempt(@Param('id') attemptId: string, @CurrentUser() currentUser: any) {
    return this.examAttemptService.submitAttempt(attemptId, currentUser);
  }

  @Get(':id/remaining-time')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ORG_ADMIN, Role.SYSTEM_ADMIN)
  @Permissions('read:exam')
  getRemainingTime(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.examAttemptService.getRemainingTime(id, currentUser);
  }
}
