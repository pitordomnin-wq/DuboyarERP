import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { OrganizationService } from './organization.service';
import { UpdateOrganizationDto } from './dto';
import { MulterExceptionFilter } from '../mailbox/multer.filter';
import { MAX_AVATAR_BYTES } from '../auth/avatar-storage';

@Controller('organization')
@UseGuards(AuthGuard)
export class OrganizationLogoController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('logo')
  logo(@CurrentUser() user: AuthUser) {
    return this.organization.logoFile(user);
  }
}

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

  @Post('logo')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES },
    }),
  )
  setLogo(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.organization.setLogo(user, file);
  }

  @Delete('logo')
  removeLogo(@CurrentUser() user: AuthUser) {
    return this.organization.removeLogo(user);
  }

  @Post('reset')
  reset(@CurrentUser() user: AuthUser) {
    return this.organization.resetDemo(user);
  }
}
