import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type XpressItemDocument = HydratedDocument<XpressItem>;

@Schema({
  collection: 'xpress_items',
  strict: false,
  versionKey: false,
})
export class XpressItem {
  @Prop({ required: true })
  PK!: string;

  @Prop({ required: true })
  SK!: string;

  @Prop({ required: true, index: true })
  entityType!: string;

  @Prop({ index: true })
  GSI1PK?: string;

  @Prop({ index: true })
  GSI1SK?: string;
}

export const XpressItemSchema = SchemaFactory.createForClass(XpressItem);

XpressItemSchema.index({ PK: 1, SK: 1 }, { unique: true });
XpressItemSchema.index({ GSI1PK: 1, GSI1SK: 1 });
XpressItemSchema.index({ entityType: 1, userId: 1 });
XpressItemSchema.index({ entityType: 1, ownerUserId: 1, status: 1 });
XpressItemSchema.index({ entityType: 1, roomId: 1 });
XpressItemSchema.index({ entityType: 1, conversationId: 1, createdAt: 1 });
XpressItemSchema.index({ entityType: 1, postId: 1, createdAt: 1 });

