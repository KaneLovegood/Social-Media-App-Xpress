import { IsIn } from 'class-validator';

export class GroupCallStateDto {
  @IsIn(['voice', 'video'])
  mode: 'voice' | 'video';

  @IsIn(['ringing', 'active', 'ended'])
  state: 'ringing' | 'active' | 'ended';
}
