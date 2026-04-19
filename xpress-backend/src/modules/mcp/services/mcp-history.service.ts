import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessagesRepository } from '../../chat/repositories/messages.repository';
import { MessageEntity } from '../../chat/interfaces/message.interface';

@Injectable()
export class McpHistoryService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  private getConversationId(userId: string): string {
    return `AI_ASSISTANT#${userId}`;
  }

  async saveMessage(
    senderId: string,
    receiverId: string,
    content: string,
    userId: string,
    fileUrl?: string,
  ): Promise<MessageEntity> {
    const now = new Date().toISOString();
    const messageId = randomUUID();
    const conversationId = this.getConversationId(userId);

    const item: MessageEntity = {
      PK: `MESSAGE#${messageId}`,
      SK: `MESSAGE#${messageId}`,
      GSI1PK: `CONVERSATION#${conversationId}`,
      GSI1SK: `${now}#${messageId}`,
      entityType: 'MESSAGE',
      messageId,
      conversationId,
      senderId,
      receiverId,
      content,
      messageType: fileUrl ? 'FILE' : 'TEXT',
      fileUrl,
      isDeleted: false,
      isRecalled: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.messagesRepository.createMessage(item);
    return item;
  }

  async getHistory(userId: string): Promise<
    Array<{
      message: string;
      role: 'ai' | 'user';
      fileUrl?: string;
      createdAt: string;
    }>
  > {
    const conversationId = this.getConversationId(userId);
    // Retrieve typed messages from repository
    const messages: MessageEntity[] =
      await this.messagesRepository.findMessagesByConversationId(
        conversationId,
      );

    return messages.map((msg) => ({
      message: msg.content,
      role: msg.senderId === 'AI_ASSISTANT' ? 'ai' : 'user',
      fileUrl: msg.fileUrl,
      createdAt: msg.createdAt,
    }));
  }
}
