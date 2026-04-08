import {
	CanActivate,
	ExecutionContext,
	Injectable,
	Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtUtilService } from '../../modules/socket/utils/jwt.util';

@Injectable()
export class WsJwtGuard implements CanActivate {
	private readonly logger = new Logger(WsJwtGuard.name);

	constructor(private readonly jwtUtilService: JwtUtilService) {}

	canActivate(context: ExecutionContext): boolean {
		const client = context.switchToWs().getClient<Socket>();
		const token = this.jwtUtilService.extractTokenFromClient(client);

		if (!token) {
			this.logger.warn(`Missing websocket token. socketId=${client.id}`);
			throw new WsException('Unauthorized');
		}

		try {
			const payload = this.jwtUtilService.verifyToken(token);
			client.data.userId = payload.userId;
			return true;
		} catch {
			this.logger.warn(`Authentication failure. socketId=${client.id}`);
			throw new WsException('Unauthorized');
		}
	}
}
