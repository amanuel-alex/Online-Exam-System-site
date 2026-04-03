import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // Protects all /users routes with JWT
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN) // Only Admins can fetch all users
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    // CurrentUser decorator gives us the user retrieved in JwtStrategy
    return this.usersService.findOne(user.id);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN, Role.ORG_ADMIN, Role.TEACHER)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
