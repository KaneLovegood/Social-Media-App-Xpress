import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { XpressItem, XpressItemSchema } from './xpress-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: XpressItem.name, schema: XpressItemSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoDbModule {}

