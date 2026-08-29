import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController, UserAvatarController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UserAvatarController, UsersController],
  providers: [UsersService],
})
export class UsersModule {}
