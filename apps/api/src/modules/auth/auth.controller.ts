import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { InitializeSystemDto } from './dto/initialize-system.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('setup-status')
  getSetupStatus() {
    return this.authService.getSetupStatus();
  }

  @Post('initialize')
  initialize(@Body() dto: InitializeSystemDto) {
    return this.authService.initialize(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshSessionDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshSessionDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    const { sessionId: _sessionId, ...profile } = user;
    return profile;
  }
}

