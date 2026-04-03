import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AttemptService } from './attempts.service';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('attempts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post('start/:examId')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  startAttempt(@Param('examId') examId: string, @CurrentUser() currentUser: any) {
    return this.attemptService.startAttempt(examId, currentUser);
  }

  @Post(':id/save-answer')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  saveAnswer(
    @Param('id') attemptId: string,
    @Body() dto: SaveAnswerDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.attemptService.saveAnswer(attemptId, dto, currentUser);
  }

  @Post(':id/submit')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  submitAttempt(@Param('id') attemptId: string, @CurrentUser() currentUser: any) {
    return this.attemptService.submitAttempt(attemptId, currentUser);
  }

  @Get(':id')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ORG_ADMIN, Role.SYSTEM_ADMIN)
  @Permissions('read:exam')
  findAttempt(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.attemptService.findAttempt(id, currentUser);
  }
}
