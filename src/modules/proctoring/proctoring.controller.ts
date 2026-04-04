import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { ProctoringService } from './proctoring.service';
import { LogProctoringEventDto } from './dto/log-proctoring-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('proctoring')
@UseGuards(JwtAuthGuard)
export class ProctoringController {
  constructor(private readonly proctoringService: ProctoringService) {}

  @Post('log')
  async logEvent(
    @Body() dto: LogProctoringEventDto, 
    @CurrentUser() user: any
  ) {
    return this.proctoringService.logEvent(dto, user);
  }

  @Get('analysis/:attemptId')
  @UseGuards(RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.EXAMINER)
  async getAnalysis(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: any
  ) {
    return this.proctoringService.getAttemptAnalysis(attemptId, user);
  }
}
