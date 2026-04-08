import { IsNotEmpty, IsObject, IsString } from 'class-validator';

class BaseCallDto {
	@IsString()
	@IsNotEmpty()
	toUserId!: string;
}

export class CallInviteDto extends BaseCallDto {
	@IsObject()
	offer!: Record<string, unknown>;
}

export class CallAnswerDto extends BaseCallDto {
	@IsObject()
	answer!: Record<string, unknown>;
}

export class CallIceDto extends BaseCallDto {
	@IsObject()
	candidate!: Record<string, unknown>;
}

export class CallRejectDto extends BaseCallDto {}

export class CallEndDto extends BaseCallDto {}
