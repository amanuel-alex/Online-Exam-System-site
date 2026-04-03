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
import { QuestionBankService } from './question-bank.service';
import { QuestionBankCreateDto } from './dto/create-question.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { UpdateQuestionBankDto } from './dto/update-question.dto';
import { QuestionBankQueryDto } from './dto/question-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

import { MultiTenantGuard } from '../../common/guards/multi-tenant.guard';

@Controller('question-bank')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, MultiTenantGuard)
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('create:question')
  create(@Body() dto: QuestionBankCreateDto, @CurrentUser() currentUser: any) {
    return this.questionBankService.create(dto, currentUser);
  }

  @Post('bulk')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('create:question')
  createBulk(@Body() dto: BulkCreateQuestionsDto, @CurrentUser() currentUser: any) {
    return this.questionBankService.createBulk(dto, currentUser);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:question')
  findAll(@Query() query: QuestionBankQueryDto, @CurrentUser() currentUser: any) {
    return this.questionBankService.findAll(query, currentUser);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:question')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionBankService.findOne(id, currentUser);
  }

  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:question')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionBankDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.questionBankService.update(id, dto, currentUser);
  }

  @Patch(':id/archive')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:question')
  archive(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionBankService.archive(id, currentUser);
  }

  @Patch(':id/restore')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:question')
  restore(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.questionBankService.restore(id, currentUser);
  }
}
