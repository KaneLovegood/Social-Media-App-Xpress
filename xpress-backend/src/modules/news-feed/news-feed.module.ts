import { Module } from '@nestjs/common';
import { MongoDbModule } from '../../common/mongodb/mongodb.module';
import { AuthModule } from '../auth/auth.module';
import { SocialModule } from '../social/social.module';
import { NewsFeedController } from './news-feed.controller';
import { NewsFeedGateway } from './news-feed.gateway';
import { NewsFeedService } from './news-feed.service';
import { NewsFeedRepository } from './repositories/news-feed.repository';

@Module({
  imports: [MongoDbModule, AuthModule, SocialModule],
  controllers: [NewsFeedController],
  providers: [NewsFeedService, NewsFeedRepository, NewsFeedGateway],
  exports: [NewsFeedService, NewsFeedGateway],
})
export class NewsFeedModule {}
