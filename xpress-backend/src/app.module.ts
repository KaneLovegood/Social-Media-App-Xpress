import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { DeviceSessionModule } from './modules/device-session/device-session.module';
import { SocialModule } from './modules/social/social.module';
import { StorageModule } from './modules/storage/storage.module';
import { McpModule } from './modules/mcp/mcp.module';
import { NewsFeedModule } from './modules/news-feed/news-feed.module';
import { JwtGuard } from './middleware/jwt.guard';

const mongoUri = process.env.MONGODB_SESSION_URI ?? 'mongodb://localhost:27017/xpress-session';
@Module({
  imports: [
    MongooseModule.forRoot(mongoUri, {
      // single-device-session collection is tiny; keep pool small.
      minPoolSize: 1,
      maxPoolSize: 5,
    }),
    DeviceSessionModule,
    AuthModule,
    ChatModule,
    SocialModule,
    StorageModule,
    McpModule,
    NewsFeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}
