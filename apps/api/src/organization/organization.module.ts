import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationController, OrganizationLogoController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationLogoController, OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
