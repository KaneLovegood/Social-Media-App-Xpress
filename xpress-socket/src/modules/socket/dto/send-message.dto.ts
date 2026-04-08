import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
	@IsString()
	@IsNotEmpty()
	toUserId!: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(5000)
	message!: string;
}
