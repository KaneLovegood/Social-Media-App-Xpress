import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { CallGateway } from './gateways/call.gateway';
import { ChatGateway } from './gateways/chat.gateway';
import { CallService } from './service/call.service';
import { ChatService } from './service/chat.service';
import { SocketService } from './service/socket.service';
import { JwtUtilService } from './utils/jwt.util';

@Module({
	imports: [ConfigModule],
	providers: [
		SocketService,
		ChatService,
		CallService,
		JwtUtilService,
		WsJwtGuard,
		ChatGateway,
		CallGateway,
	],
	exports: [SocketService, ChatService, CallService, JwtUtilService],
})
export class SocketModule {}
