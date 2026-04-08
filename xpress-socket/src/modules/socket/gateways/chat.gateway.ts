import {
	Logger,
	UseFilters,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
	WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsExceptionFilter } from '../../../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../../../common/guards/ws-jwt.guard';
import { SendMessageDto } from '../dto/send-message.dto';
import { ChatService } from '../service/chat.service';
import { SocketService } from '../service/socket.service';
import { JwtUtilService } from '../utils/jwt.util';

@WebSocketGateway({
	cors: {
		origin: ['http://localhost:5173', 'http://localhost:3000'],
	},
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
@UsePipes(
	new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		transform: true,
	}),
)
export class ChatGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
	private readonly logger = new Logger(ChatGateway.name);

	@WebSocketServer()
	private server!: Server;

	constructor(
		private readonly chatService: ChatService,
		private readonly socketService: SocketService,
		private readonly jwtUtilService: JwtUtilService,
	) {}

	afterInit(): void {
		this.socketService.setServer(this.server);
	}

	handleConnection(client: Socket): void {
		const token = this.jwtUtilService.extractTokenFromClient(client);
		if (!token) {
			this.logger.warn(`Auth failed (missing token). socketId=${client.id}`);
			client.disconnect(true);
			return;
		}

		try {
			const payload = this.jwtUtilService.verifyToken(token);
			client.data.userId = payload.userId;
			client.join(payload.userId);
			this.socketService.addSocket(payload.userId, client.id);
			this.logger.log(`Client connected. userId=${payload.userId}, socketId=${client.id}`);
		} catch {
			this.logger.warn(`Auth failed (invalid token). socketId=${client.id}`);
			client.disconnect(true);
		}
	}

	handleDisconnect(client: Socket): void {
		const userId = client.data.userId as string | undefined;
		if (userId) {
			this.socketService.removeSocket(userId, client.id);
			this.logger.log(`Client disconnected. userId=${userId}, socketId=${client.id}`);
			return;
		}

		this.logger.log(`Client disconnected. socketId=${client.id}`);
	}

	@SubscribeMessage('chat:send')
	handleSendMessage(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: SendMessageDto,
	): void {
		const senderId = client.data.userId as string | undefined;
		if (!senderId) {
			throw new WsException('Unauthorized');
		}

		this.chatService.handleSendMessage(senderId, payload);
	}
}
