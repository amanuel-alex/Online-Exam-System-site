import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionQueryDto } from './dto/question-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // ─── POST /questions ─────────────────────────
  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('create:question')
  create(@Body() dto: CreateQuestionDto, @CurrentUser() currentUser: any) {
    return this.questionsService.create(dto, currentUser);
  }

  // ─── GET /questions ──────────────────────────
  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:question')
  findAll(@Query() query: QuestionQueryDto, @CurrentUser() currentUser: any) {
    return this.questionsService.findAll(query, currentUser);
  }

  // ─── GET /questions/:id ──────────────────────
  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:question')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionsService.findOne(id, currentUser);
  }

  // ─── PUT /questions/:id ──────────────────────
  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:question')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.questionsService.update(id, dto, currentUser);
  }

  // ─── PATCH /questions/:id/archive ───────────
  @Patch(':id/archive')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:question')
  archive(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionsService.archive(id, currentUser);
  }

  // ─── PATCH /questions/:id/restore ───────────
  @Patch(':id/restore')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:question')
  restore(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionsService.restore(id, currentUser);
  }

  // ─── DELETE /questions/:id ──────────────────
  @Delete(':id')
  @Roles(Role.SYSTEM_ADMIN)
  @Permissions('delete:question')
  remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionsService.remove(id, currentUser);
  }
}
