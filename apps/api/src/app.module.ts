import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NovofonModule } from './novofon/novofon.module';
import { TasksModule } from './tasks/tasks.module';
import { CounterpartiesModule } from './counterparties/counterparties.module';
import { SalesModule } from './sales/sales.module';
import { ProductsModule } from './products/products.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ProductionModule } from './production/production.module';
import { MailboxModule } from './mailbox/mailbox.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { OrganizationModule } from './organization/organization.module';
import { HomeModule } from './home/home.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    NovofonModule,
    TasksModule,
    CounterpartiesModule,
    ProductsModule,
    WarehouseModule,
    PurchasesModule,
    ProductionModule,
    SalesModule,
    MailboxModule,
    UsersModule,
    RolesModule,
    OrganizationModule,
    HomeModule,
  ],
})
export class AppModule {}
