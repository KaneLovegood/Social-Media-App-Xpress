import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import {
	CallAnswerDto,
	CallEndDto,
	CallIceDto,
	CallInviteDto,
	CallRejectDto,
} from '../dto/call.dto';
import { SocketService } from './socket.service';

@Injectable()
export class CallService {
	private readonly logger = new Logger(CallService.name);

	constructor(private readonly socketService: SocketService) {}

	handleCallUser(senderId: string, payload: CallInviteDto): void {
		this.assertSender(senderId);
		this.socketService.sendToUser(payload.toUserId, 'call:incoming', {
			fromUserId: senderId,
			offer: payload.offer,
		});
		this.logger.log(`call:invite processed. from=${senderId}, to=${payload.toUserId}`);
	}

	handleAnswerCall(senderId: string, payload: CallAnswerDto): void {
		this.assertSender(senderId);
		this.socketService.sendToUser(payload.toUserId, 'call:answered', {
			fromUserId: senderId,
			answer: payload.answer,
		});
		this.logger.log(`call:answer processed. from=${senderId}, to=${payload.toUserId}`);
	}

	handleIceCandidate(senderId: string, payload: CallIceDto): void {
		this.assertSender(senderId);
		this.socketService.sendToUser(payload.toUserId, 'call:ice', {
			fromUserId: senderId,
			candidate: payload.candidate,
		});
		this.logger.log(`call:ice processed. from=${senderId}, to=${payload.toUserId}`);
	}

	handleRejectCall(senderId: string, payload: CallRejectDto): void {
		this.assertSender(senderId);
		this.socketService.sendToUser(payload.toUserId, 'call:reject', {
			fromUserId: senderId,
		});
		this.logger.log(`call:reject processed. from=${senderId}, to=${payload.toUserId}`);
	}

	handleEndCall(senderId: string, payload: CallEndDto): void {
		this.assertSender(senderId);
		this.socketService.sendToUser(payload.toUserId, 'call:end', {
			fromUserId: senderId,
		});
		this.logger.log(`call:end processed. from=${senderId}, to=${payload.toUserId}`);
	}

	private assertSender(senderId: string): void {
		if (!senderId) {
			throw new WsException('Unauthorized sender');
		}
	}
}
