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
import { ExamService } from './exam.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AutoSelectQuestionsDto } from './dto/auto-select.dto';
import { ExamQueryDto } from '../exams/dto/exam-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('exam')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('create:exam')
  create(@Body() dto: CreateExamDto, @CurrentUser() currentUser: any) {
    return this.examService.create(dto, currentUser);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:exam')
  findAll(@Query() query: ExamQueryDto, @CurrentUser() currentUser: any) {
    return this.examService.findAll(query, currentUser);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:exam')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.examService.findOne(id, currentUser);
  }

  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.examService.update(id, dto, currentUser);
  }

  @Post(':id/auto-select')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  autoSelect(@Param('id') id: string, @Body() dto: AutoSelectQuestionsDto, @CurrentUser() currentUser: any) {
    return this.examService.autoSelectQuestions(id, dto, currentUser);
  }

  @Post(':id/start')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN)
  @Permissions('start:exam')
  startExam(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.examService.startExam(id, currentUser);
  }
}
