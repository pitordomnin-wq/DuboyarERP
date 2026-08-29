import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { OrganizationService } from './organization.service';
import { UpdateOrganizationDto } from './dto';

@Controller('admin/organization')
@UseGuards(AuthGuard, AdminGuard)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.organization.get(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateOrganizationDto) {
    return this.organization.update(user, body);
  }
}
