import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { DeviceSessionModule } from '../device-session/device-session.module';
import { EmailOtpService } from './email-otp.service';
import { AuthController } from './auth.controller';
import { AuthSessionGateway } from './auth-session.gateway';
import { AuthService } from './auth.service';
import { EmailOtpRepository } from './repositories/email-otp.repository';
import { SessionRepository } from './repositories/session.repository';
import { UsersRepository } from './repositories/users.repository';
import { JwtStrategy } from './strategies/jwt.strategy';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not defined');
}

@Module({
  imports: [
    DynamoDbModule,
    DeviceSessionModule,
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '10m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionGateway,
    EmailOtpService,
    UsersRepository,
    EmailOtpRepository,
    SessionRepository,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    JwtModule,
    UsersRepository,
    EmailOtpRepository,
    SessionRepository,
  ],
})
export class AuthModule {}
