import { Inject, Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import { MessageEntity, ReplyPreview } from '../interfaces/message.interface';

@Injectable()
export class MessagesRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async createMessage(item: MessageEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async findByMessageId(messageId: string): Promise<MessageEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
        },
      }),
    );

    return (result.Item as MessageEntity) ?? null;
  }

  async softDeleteMessage(messageId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
        },
        ConditionExpression: 'attribute_exists(PK) AND isDeleted = :isDeleted',
        UpdateExpression:
          'SET isDeleted = :trueValue, deletedAt = :nowValue, updatedAt = :nowValue',
        ExpressionAttributeValues: {
          ':isDeleted': false,
          ':trueValue': true,
          ':nowValue': now,
        },
      }),
    );
  }

  async recallMessage(messageId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
        },
        ConditionExpression:
          'attribute_exists(PK) AND isDeleted = :isDeleted AND isRecalled = :isRecalled',
        UpdateExpression:
          'SET isRecalled = :trueValue, content = :recalledContent, recalledAt = :nowValue, updatedAt = :nowValue',
        ExpressionAttributeValues: {
          ':isDeleted': false,
          ':isRecalled': false,
          ':trueValue': true,
          ':recalledContent': 'Tin nhắn đã được thu hồi',
          ':nowValue': now,
        },
      }),
    );
  }

  async findMessagesByUser(userId: string): Promise<MessageEntity[]> {
    const items: MessageEntity[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.ddbDocClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            'entityType = :messageEntity AND (senderId = :userId OR receiverId = :userId)',
          ExpressionAttributeValues: {
            ':messageEntity': 'MESSAGE',
            ':userId': userId,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (Array.isArray(result.Items)) {
        items.push(...(result.Items as MessageEntity[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }

  async findMessagesByConversationId(
    conversationId: string,
  ): Promise<MessageEntity[]> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `CONVERSATION#${conversationId}`,
        },
        ScanIndexForward: true,
      }),
    );

    return (result.Items as MessageEntity[]) ?? [];
  }

  async findLatestMessageByConversationId(
    conversationId: string,
  ): Promise<MessageEntity | null> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `CONVERSATION#${conversationId}`,
        },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );

    return (result.Items?.[0] as MessageEntity) ?? null;
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
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `MESSAGE#${messageId}`,
          SK: `MESSAGE#${messageId}`,
        },
        UpdateExpression:
          'SET receivedAt = :receivedAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':receivedAt': now,
          ':updatedAt': now,
        },
      }),
    );

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
    const messages = await this.findMessagesByConversationId(conversationId);
    const unread = messages.filter(
      (message) =>
        message.receiverId === receiverId &&
        !message.readAt &&
        !message.isDeleted,
    );

    if (unread.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    await Promise.all(
      unread.map((message) =>
        this.ddbDocClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: `MESSAGE#${message.messageId}`,
              SK: `MESSAGE#${message.messageId}`,
            },
            UpdateExpression: 'SET readAt = :readAt, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':readAt': now,
              ':updatedAt': now,
            },
          }),
        ),
      ),
    );

    return unread.map((message) => message.messageId);
  }

  buildReplyPreview(message: MessageEntity): ReplyPreview {
    return {
      messageId: message.messageId,
      senderId: message.senderId,
      content: message.content,
    };
  }

  async findImagesByConversationId(
    conversationId: string,
  ): Promise<MessageEntity[]> {
    const messages = await this.findMessagesByConversationId(conversationId);
    return messages.filter(
      (message) =>
        !message.isDeleted &&
        /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(message.content),
    );
  }

  async findFilesByConversationId(
    conversationId: string,
  ): Promise<MessageEntity[]> {
    const messages = await this.findMessagesByConversationId(conversationId);
    return messages.filter(
      (message) =>
        !message.isDeleted &&
        /\.[a-z0-9]{2,5}$/i.test(message.content) &&
        !/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(message.content),
    );
  }
}
