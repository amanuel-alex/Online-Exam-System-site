import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  UnauthorizedException,
  BadRequestException
} from '@nestjs/common';
import { IdentityService } from './identity.service';
import { SubmitIdentityDto } from './dto/submit-identity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, VerificationStatus } from '@prisma/client';

@Controller('identity')
@UseGuards(JwtAuthGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('submit')
  async submit(@Body() dto: SubmitIdentityDto, @CurrentUser() user: any) {
    if (!user.id) throw new UnauthorizedException('Authentication missing userId');
    return this.identityService.submitIdentity(user.id, dto);
  }

  @Get('status')
  async getStatus(@CurrentUser() user: any) {
    return this.identityService.getMyIdentity(user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.EXAMINER)
  async getPending(@CurrentUser() user: any) {
    console.log('DEBUG: User in getPending:', { id: user.id, role: user.role, orgId: user.organizationId });
    
    // SYSTEM_ADMIN doesn't need an org context
    if (user.role !== 'SYSTEM_ADMIN' && !user.organizationId) {
      throw new BadRequestException('Organization ID missing from user context.');
    }
    return this.identityService.findAllPending(user.organizationId);
  }

  @Patch('verify/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN)
  async verify(
    @Param('id') identityId: string,
    @Body('status') status: VerificationStatus,
    @Body('rejectionReason') rejectionReason: string,
    @CurrentUser() user: any
  ) {
    return this.identityService.verifyIdentity(identityId, user.id, status, rejectionReason);
  }
}
