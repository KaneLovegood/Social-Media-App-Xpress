import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDeviceSessionDocument = HydratedDocument<UserDeviceSession>;

/**
 * Single-device-session binding stored in MongoDB.
 *
 * Each user has exactly one active row that records:
 *  - currentDeviceId:   the deviceId of the device that owns the session
 *                       (mobile: @capacitor/device UUID, web: localStorage UUID)
 *  - currentSessionId:  the sessionId embedded inside the current JWT (`sid`)
 *  - currentSocketId:   the socket.io socket id of the /device-sessions
 *                       connection owned by that device (when online)
 *  - platform / deviceName: optional metadata for UI / debugging
 *
 * Used by JwtStrategy to invalidate old tokens when `sid !== currentSessionId`,
 * and by DeviceSessionService to emit FORCE_LOGOUT to the previous socketId.
 */
@Schema({ collection: 'user_device_sessions', timestamps: true })
export class UserDeviceSession {
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ required: true })
  currentDeviceId!: string;

  @Prop({ required: true })
  currentSessionId!: string;

  @Prop({ default: null, type: String })
  currentSocketId!: string | null;

  @Prop({ default: null, type: String })
  platform!: string | null;

  @Prop({ default: null, type: String })
  deviceName!: string | null;

  @Prop({ default: () => new Date() })
  lastSeenAt!: Date;
}

export const UserDeviceSessionSchema =
  SchemaFactory.createForClass(UserDeviceSession);
