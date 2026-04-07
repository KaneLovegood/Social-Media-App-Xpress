import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(WsExceptionFilter.name);

	catch(exception: WsException, host: ArgumentsHost): void {
		const client = host.switchToWs().getClient<Socket>();
		const error = exception.getError();
		const message =
			typeof error === 'string'
				? error
				: (error as { message?: string }).message ?? 'Websocket error';

		this.logger.warn(`WsException: ${message}. socketId=${client.id}`);
		client.emit('error', {
			message,
			timestamp: new Date().toISOString(),
		});
	}
}
