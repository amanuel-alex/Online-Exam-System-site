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
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AssignQuestionsDto } from './dto/assign-questions.dto';
import { ExamQueryDto } from './dto/exam-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('create:exam')
  create(@Body() dto: CreateExamDto, @CurrentUser() currentUser: any) {
    return this.examsService.create(dto, currentUser);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:exam')
  findAll(@Query() query: ExamQueryDto, @CurrentUser() currentUser: any) {
    return this.examsService.findAll(query, currentUser);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER, Role.STUDENT)
  @Permissions('read:exam')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.examsService.findOne(id, currentUser);
  }

  @Put(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.examsService.update(id, dto, currentUser);
  }

  @Post(':id/questions')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('update:exam')
  assignQuestions(
    @Param('id') id: string,
    @Body() dto: AssignQuestionsDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.examsService.assignQuestions(id, dto, currentUser);
  }

  @Post(':id/start')
  @Roles(Role.STUDENT, Role.TEACHER, Role.SYSTEM_ADMIN) // Admins can start tests to preview
  @Permissions('start:exam')
  startExam(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.examsService.startExam(id, currentUser);
  }

  @Get(':id/questions')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER, Role.EXAMINER)
  @Permissions('read:exam')
  getQuestions(@Param('id') id: string) {
    return this.examsService.getExamQuestions(id, false);
  }
}
