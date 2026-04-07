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
import {
	CallAnswerDto,
	CallEndDto,
	CallIceDto,
	CallInviteDto,
	CallRejectDto,
} from '../dto/call.dto';
import { CallService } from '../service/call.service';
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
export class CallGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
	private readonly logger = new Logger(CallGateway.name);

	@WebSocketServer()
	private server!: Server;

	constructor(
		private readonly callService: CallService,
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

	@SubscribeMessage('call:invite')
	handleCallInvite(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: CallInviteDto,
	): void {
		const senderId = client.data.userId as string | undefined;
		if (!senderId) {
			throw new WsException('Unauthorized');
		}

		this.callService.handleCallUser(senderId, payload);
	}

	@SubscribeMessage('call:answer')
	handleCallAnswer(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: CallAnswerDto,
	): void {
		const senderId = client.data.userId as string | undefined;
		if (!senderId) {
			throw new WsException('Unauthorized');
		}

		this.callService.handleAnswerCall(senderId, payload);
	}

	@SubscribeMessage('call:ice')
	handleCallIce(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: CallIceDto,
	): void {
		const senderId = client.data.userId as string | undefined;
		if (!senderId) {
			throw new WsException('Unauthorized');
		}

		this.callService.handleIceCandidate(senderId, payload);
	}

	@SubscribeMessage('call:reject')
	handleCallReject(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: CallRejectDto,
	): void {
		const senderId = client.data.userId as string | undefined;
		if (!senderId) {
			throw new WsException('Unauthorized');
		}

		this.callService.handleRejectCall(senderId, payload);
	}

	@SubscribeMessage('call:end')
	handleCallEnd(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: CallEndDto,
	): void {
		const senderId = client.data.userId as string | undefined;
		if (!senderId) {
			throw new WsException('Unauthorized');
		}

		this.callService.handleEndCall(senderId, payload);
	}
}
