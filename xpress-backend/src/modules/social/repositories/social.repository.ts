import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import {
  BlockEntity,
  FriendEntity,
  FriendStatus,
} from '../interfaces/social.interface';

@Injectable()
export class SocialRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async getFriend(
    ownerUserId: string,
    targetUserId: string,
  ): Promise<FriendEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${ownerUserId}`,
          SK: `FRIEND#${targetUserId}`,
        },
      }),
    );

    return (result.Item as FriendEntity) ?? null;
  }

  async saveFriendPair(
    actorUserId: string,
    targetUserId: string,
    actorStatus: FriendStatus,
    targetStatus: FriendStatus,
  ): Promise<void> {
    const now = new Date().toISOString();
    const actorFriend = await this.getFriend(actorUserId, targetUserId);
    const targetFriend = await this.getFriend(targetUserId, actorUserId);

    const actorItem: FriendEntity = {
      PK: `USER#${actorUserId}`,
      SK: `FRIEND#${targetUserId}`,
      entityType: 'FRIEND',
      ownerUserId: actorUserId,
      targetUserId,
      status: actorStatus,
      createdAt: actorFriend?.createdAt ?? now,
      updatedAt: now,
    };

    const targetItem: FriendEntity = {
      PK: `USER#${targetUserId}`,
      SK: `FRIEND#${actorUserId}`,
      entityType: 'FRIEND',
      ownerUserId: targetUserId,
      targetUserId: actorUserId,
      status: targetStatus,
      createdAt: targetFriend?.createdAt ?? now,
      updatedAt: now,
    };

    await this.ddbDocClient.send(
      new PutCommand({ TableName: this.tableName, Item: actorItem }),
    );
    await this.ddbDocClient.send(
      new PutCommand({ TableName: this.tableName, Item: targetItem }),
    );
  }

  async removeFriendPair(userAId: string, userBId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userAId}`,
          SK: `FRIEND#${userBId}`,
        },
      }),
    );

    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userBId}`,
          SK: `FRIEND#${userAId}`,
        },
      }),
    );
  }

  async listFriendsByStatus(
    ownerUserId: string,
    status: FriendStatus,
    limit = 20,
    cursor?: string,
  ): Promise<{ items: FriendEntity[]; nextCursor: string | null }> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'entityType = :entityType AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${ownerUserId}`,
          ':sk': 'FRIEND#',
          ':entityType': 'FRIEND',
          ':status': status,
        },
        Limit: limit,
        ExclusiveStartKey: this.decodeCursor(cursor),
      }),
    );

    return {
      items: (result.Items as FriendEntity[]) ?? [],
      nextCursor: this.encodeCursor(result.LastEvaluatedKey),
    };
  }

  async listBlockedUsers(
    ownerUserId: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ items: BlockEntity[]; nextCursor: string | null }> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'entityType = :entityType',
        ExpressionAttributeValues: {
          ':pk': `USER#${ownerUserId}`,
          ':sk': 'BLOCK#',
          ':entityType': 'BLOCK',
        },
        Limit: limit,
        ExclusiveStartKey: this.decodeCursor(cursor),
      }),
    );

    return {
      items: (result.Items as BlockEntity[]) ?? [],
      nextCursor: this.encodeCursor(result.LastEvaluatedKey),
    };
  }

  async setBlocked(ownerUserId: string, targetUserId: string): Promise<void> {
    const block: BlockEntity = {
      PK: `USER#${ownerUserId}`,
      SK: `BLOCK#${targetUserId}`,
      entityType: 'BLOCK',
      ownerUserId,
      targetUserId,
      createdAt: new Date().toISOString(),
    };

    await this.ddbDocClient.send(
      new PutCommand({ TableName: this.tableName, Item: block }),
    );
  }

  async unblock(ownerUserId: string, targetUserId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${ownerUserId}`,
          SK: `BLOCK#${targetUserId}`,
        },
      }),
    );
  }

  async isBlocked(ownerUserId: string, targetUserId: string): Promise<boolean> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${ownerUserId}`,
          SK: `BLOCK#${targetUserId}`,
        },
      }),
    );

    return Boolean(result.Item);
  }

  async isEitherBlocked(userAId: string, userBId: string): Promise<boolean> {
    const [a, b] = await Promise.all([
      this.isBlocked(userAId, userBId),
      this.isBlocked(userBId, userAId),
    ]);

    return a || b;
  }

  private encodeCursor(
    lastEvaluatedKey?: Record<string, unknown>,
  ): string | null {
    if (!lastEvaluatedKey) return null;
    return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString(
      'base64',
    );
  }

  private decodeCursor(cursor?: string): Record<string, unknown> | undefined {
    if (!cursor) return undefined;

    try {
      const json = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}
