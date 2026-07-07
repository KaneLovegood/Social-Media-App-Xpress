import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import { MessageEntity, ReplyPreview } from '../interfaces/message.interface';

@Injectable()
export class MessagesRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async createMessage(item: MessageEntity): Promise<void> {
    await this.itemModel.create(item);
  }

  async findByMessageId(messageId: string): Promise<MessageEntity | null> {
    return this.itemModel
      .findOne({
        PK: `MESSAGE#${messageId}`,
        SK: `MESSAGE#${messageId}`,
      })
      .select('-_id')
      .lean<MessageEntity>()
      .exec();
  }

  async softDeleteMessage(messageId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.itemModel
      .updateOne(
        {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
          isDeleted: false,
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          },
        },
      )
      .exec();
  }

  async recallMessage(messageId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.itemModel
      .updateOne(
        {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
          isDeleted: false,
          isRecalled: false,
        },
        {
          $set: {
            isRecalled: true,
            content: 'Tin nhắn đã được thu hồi',
            recalledAt: now,
            updatedAt: now,
          },
        },
      )
      .exec();
  }

  async findMessagesByUser(userId: string): Promise<MessageEntity[]> {
    return this.itemModel
      .find({
        entityType: 'MESSAGE',
        $or: [{ senderId: userId }, { receiverId: userId }],
      })
      .sort({ createdAt: 1 })
      .select('-_id')
      .lean<MessageEntity[]>()
      .exec();
  }

  async findMessagesByConversationId(
    conversationId: string,
  ): Promise<MessageEntity[]> {
    return this.itemModel
      .find({
        entityType: 'MESSAGE',
        GSI1PK: `CONVERSATION#${conversationId}`,
      })
      .sort({ GSI1SK: 1, createdAt: 1 })
      .select('-_id')
      .lean<MessageEntity[]>()
      .exec();
  }

  async findLatestMessageByConversationId(
    conversationId: string,
  ): Promise<MessageEntity | null> {
    return this.itemModel
      .findOne({
        entityType: 'MESSAGE',
        GSI1PK: `CONVERSATION#${conversationId}`,
      })
      .sort({ GSI1SK: -1, createdAt: -1 })
      .select('-_id')
      .lean<MessageEntity>()
      .exec();
  }

  async markMessageReceived(
    messageId: string,
    receiverId: string,
  ): Promise<MessageEntity | null> {
    const message = await this.findByMessageId(messageId);
    if (!message) return null;

    if (message.receiverId !== receiverId || message.receivedAt) {
      return message;
    }

    const now = new Date().toISOString();
    await this.itemModel
      .updateOne(
        {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
        },
        {
          $set: {
            receivedAt: now,
            updatedAt: now,
          },
        },
      )
      .exec();

    return {
      ...message,
      receivedAt: now,
      updatedAt: now,
    };
  }

  async markConversationAsRead(
    conversationId: string,
    receiverId: string,
  ): Promise<string[]> {
    const unread = await this.itemModel
      .find({
        entityType: 'MESSAGE',
        GSI1PK: `CONVERSATION#${conversationId}`,
        receiverId,
        readAt: { $exists: false },
        isDeleted: false,
      })
      .select('-_id')
      .lean<MessageEntity[]>()
      .exec();

    if (unread.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    await this.itemModel
      .updateMany(
        {
          messageId: { $in: unread.map((message) => message.messageId) },
        },
        {
          $set: {
            readAt: now,
            updatedAt: now,
          },
        },
      )
      .exec();

    return unread.map((message) => message.messageId);
  }

  buildReplyPreview(message: MessageEntity): ReplyPreview {
    return {
      messageId: message.messageId,
      senderId: message.senderId,
      messageType: message.messageType,
      content: message.content,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      mimeType: message.mimeType,
    };
  }

  async findImagesByConversationId(
    conversationId: string,
  ): Promise<MessageEntity[]> {
    const messages = await this.findMessagesByConversationId(conversationId);
    return messages.filter(
      (message) =>
        !message.isDeleted &&
        (message.messageType === 'IMAGE' ||
          message.messageType === 'VIDEO' ||
          (!message.messageType &&
            /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(message.content))),
    );
  }

  async findFilesByConversationId(
    conversationId: string,
  ): Promise<MessageEntity[]> {
    const messages = await this.findMessagesByConversationId(conversationId);
    return messages.filter(
      (message) =>
        !message.isDeleted &&
        (message.messageType === 'FILE' ||
          (!message.messageType &&
            /\.[a-z0-9]{2,5}$/i.test(message.content) &&
            !/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(
              message.content,
            ))),
    );
  }
}

