import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { SendMessageDto } from '../dto/send-message.dto';
import { SocketService } from './socket.service';

@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name);

	constructor(private readonly socketService: SocketService) {}

	handleSendMessage(senderId: string, payload: SendMessageDto): void {
		if (!senderId) {
			throw new WsException('Unauthorized sender');
		}

		const messagePayload = {
			fromUserId: senderId,
			toUserId: payload.toUserId,
			message: payload.message,
			sentAt: new Date().toISOString(),
		};

		this.socketService.sendToUser(payload.toUserId, 'chat:receive', messagePayload);
		this.socketService.sendToUser(senderId, 'chat:receive', messagePayload);

		this.logger.log(
			`chat:send processed. from=${senderId}, to=${payload.toUserId}`,
		);
	}
}
