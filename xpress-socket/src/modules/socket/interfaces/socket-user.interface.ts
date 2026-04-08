export interface SocketUser {
	userId: string;
	sockets: Set<string>;
	isOnline: boolean;
}
