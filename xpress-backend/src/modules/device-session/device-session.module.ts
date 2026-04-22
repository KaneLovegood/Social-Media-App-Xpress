import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { DeviceSessionController } from './device-session.controller';
import { DeviceSessionGateway } from './device-session.gateway';
import { DeviceSessionService } from './device-session.service';
import {
  UserDeviceSession,
  UserDeviceSessionSchema,
} from './schemas/user-device-session.schema';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not defined');
}

@Module({
  imports: [
    JwtModule.register({ secret: jwtSecret }),
    MongooseModule.forFeature([
      { name: UserDeviceSession.name, schema: UserDeviceSessionSchema },
    ]),
  ],
  controllers: [DeviceSessionController],
  providers: [DeviceSessionService, DeviceSessionGateway],
  exports: [DeviceSessionService],
})
export class DeviceSessionModule {}
