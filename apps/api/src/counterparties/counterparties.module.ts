import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CounterpartiesController } from './counterparties.controller';
import { CounterpartiesService } from './counterparties.service';

@Module({
  imports: [AuthModule],
  controllers: [CounterpartiesController],
  providers: [CounterpartiesService],
})
export class CounterpartiesModule {}
