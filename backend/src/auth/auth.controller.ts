import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle(5, 60)
  @ApiOperation({ summary: 'Login with email/password' })
  login(@Body() body: { email: string; password: string }, @Ip() ip: string) {
    return this.auth.login({ email: body.email, password: body.password, ip });
  }

  @Post('refresh')
  @Throttle(10, 60)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  refresh(@Body() body: { refreshToken: string }, @Ip() ip: string) {
    return this.auth.refresh({ refreshToken: body.refreshToken, ip });
  }

  @Post('logout')
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Revoke refresh token' })
  logout(@Body() body: { refreshToken: string }) {
    return this.auth.logout({ refreshToken: body.refreshToken });
  }
}
