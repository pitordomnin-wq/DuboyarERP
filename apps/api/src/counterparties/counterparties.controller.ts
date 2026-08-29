import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { CounterpartiesService } from './counterparties.service';
import { UpsertCounterpartyDto } from './dto';

@Controller('counterparties')
@UseGuards(AuthGuard)
export class CounterpartiesController {
  constructor(private readonly counterparties: CounterpartiesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.counterparties.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.counterparties.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: UpsertCounterpartyDto) {
    return this.counterparties.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpsertCounterpartyDto) {
    return this.counterparties.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.counterparties.remove(user, id);
  }
}
