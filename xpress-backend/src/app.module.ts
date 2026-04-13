import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { SocialModule } from './modules/social/social.module';

@Module({
  imports: [AuthModule, ChatModule, SocialModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
