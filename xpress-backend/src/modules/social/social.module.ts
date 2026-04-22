import { Module } from '@nestjs/common';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { PresenceModule } from '../../common/presence/presence.module';
import { AuthModule } from '../auth/auth.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { SocialRepository } from './repositories/social.repository';

@Module({
  imports: [DynamoDbModule, AuthModule, PresenceModule],
  controllers: [SocialController],
  providers: [SocialService, SocialRepository],
  exports: [SocialService],
})
export class SocialModule {}
