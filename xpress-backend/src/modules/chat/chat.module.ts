import { Module } from '@nestjs/common';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { PresenceModule } from '../../common/presence/presence.module';
import { AuthModule } from '../auth/auth.module';
import { SocialModule } from '../social/social.module';
import { StorageModule } from '../storage/storage.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatCallService } from './services/chat-call.service';
import { ChatGatewayTransportService } from './services/chat-gateway-transport.service';
import { ChatRoomService } from './services/chat-room.service';
import { GroupRoomsRepository } from './repositories/group-rooms.repository';
import { MessagesRepository } from './repositories/messages.repository';
import { AgoraService } from './services/agora.service';

@Module({
  imports: [
    DynamoDbModule,
    AuthModule,
    SocialModule,
    PresenceModule,
    StorageModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    ChatCallService,
    ChatGatewayTransportService,
    ChatRoomService,
    MessagesRepository,
    GroupRoomsRepository,
    AgoraService,
  ],
  exports: [MessagesRepository, ChatService],
})
export class ChatModule {}
