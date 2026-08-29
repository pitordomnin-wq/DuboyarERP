import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UserAvatarController {
  constructor(private readonly users: UsersService) {}

  @Get(':id/avatar')
  avatar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.avatarFile(user, id);
  }
}

@Controller('admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateUserDto) {
    return this.users.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.users.update(user, id, body);
  }
}
