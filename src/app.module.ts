import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationModule } from './modules/organization/organization.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, OrganizationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
