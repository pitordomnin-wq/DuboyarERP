import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(AuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.home.summary(user);
  }
}
