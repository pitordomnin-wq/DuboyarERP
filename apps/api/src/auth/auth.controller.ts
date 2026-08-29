import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, Res, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto, UpdateProfileDto, VerifyOtpDto } from './dto';
import { MulterExceptionFilter } from '../mailbox/multer.filter';
import { MAX_AVATAR_BYTES } from './avatar-storage';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(204)
  request(@Body() body: RequestOtpDto, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.auth.requestOtp(body.email, ip);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verify(@Body() body: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const { token, user } = await this.auth.verifyOtp(body.email, body.code, ip);
    res.cookie(this.auth.cookieName(), token, this.auth.sessionCookieOptions());
    return { user };
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.auth.me(req.cookies?.[this.auth.cookieName()]);
  }

  @Patch('me')
  updateMe(@Req() req: Request, @Body() body: UpdateProfileDto) {
    return this.auth.updateProfile(req.cookies?.[this.auth.cookieName()], body);
  }

  @Post('me/avatar')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES },
    }),
  )
  setAvatar(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    return this.auth.setAvatar(req.cookies?.[this.auth.cookieName()], file);
  }

  @Delete('me/avatar')
  removeAvatar(@Req() req: Request) {
    return this.auth.removeAvatar(req.cookies?.[this.auth.cookieName()]);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[this.auth.cookieName()]);
    res.clearCookie(this.auth.cookieName(), { path: '/' });
  }
}
