import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { AuthController } from './auth.controller';
import { AuthSessionGateway } from './auth-session.gateway';
import { AuthService } from './auth.service';
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
    UsersRepository,
    SessionRepository,
    JwtStrategy,
  ],
  exports: [AuthService, JwtModule, UsersRepository, SessionRepository],
})
export class AuthModule {}
