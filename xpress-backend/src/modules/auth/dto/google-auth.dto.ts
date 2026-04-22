import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type GoogleAuthPlatform = 'web' | 'android' | 'ios';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsOptional()
  deviceName?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  // Optional hint from the client so the server can log/metric which platform
  // produced the token. Token verification still relies on `aud` only.
  @IsOptional()
  @IsIn(['web', 'android', 'ios'])
  platform?: GoogleAuthPlatform;
}
