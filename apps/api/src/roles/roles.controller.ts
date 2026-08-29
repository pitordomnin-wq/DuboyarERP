import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@Controller('admin/roles')
@UseGuards(AuthGuard, AdminGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.roles.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRoleDto) {
    return this.roles.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.roles.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.roles.remove(user, id);
  }
}
