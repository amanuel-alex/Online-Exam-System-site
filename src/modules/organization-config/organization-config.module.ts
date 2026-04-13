import { Module } from '@nestjs/common';
import { OrganizationConfigService } from './organization-config.service';
import { OrganizationConfigController } from './organization-config.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationConfigController],
  providers: [OrganizationConfigService],
  exports: [OrganizationConfigService],
})
export class OrganizationConfigModule {}
