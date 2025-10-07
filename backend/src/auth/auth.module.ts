import { Module } from '@nestjs/common';
import { DevAuthController } from './dev-auth.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  controllers: [DevAuthController, AuthController],
  providers: [AuthService, PasswordService],
})
export class AuthModule {}
