import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SocketModule } from './modules/socket/socket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SocketModule,
  ],
})
export class AppModule {}
