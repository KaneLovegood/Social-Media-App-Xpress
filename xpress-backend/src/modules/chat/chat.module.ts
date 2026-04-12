import { Module } from '@nestjs/common';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessagesRepository } from './repositories/messages.repository';

@Module({
  imports: [DynamoDbModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, MessagesRepository],
})
export class ChatModule {}
