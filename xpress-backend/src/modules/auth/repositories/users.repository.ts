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
import { UserEntity } from '../interfaces/user.interface';

interface PaginatedUsers {
  items: UserEntity[];
  nextCursor: string | null;
}

@Injectable()
export class UsersRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const normalizedPhone = this.normalizePhone(phone);

    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `PHONE#${normalizedPhone}`,
        },
        Limit: 1,
      }),
    );

    return (result.Items?.[0] as UserEntity) ?? null;
  }

  async createUser(user: UserEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async findByUserId(userId: string): Promise<UserEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `PROFILE#${userId}`,
        },
      }),
    );

    return (result.Item as UserEntity) ?? null;
  }

  async searchByPhone(
    actorUserId: string,
    phoneQuery: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedUsers> {
    const normalized = this.normalizePhone(phoneQuery);

    const result = await this.ddbDocClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression:
          'entityType = :entityType AND userId <> :actorUserId AND contains(phone, :phoneQuery)',
        ExpressionAttributeValues: {
          ':entityType': 'USER',
          ':actorUserId': actorUserId,
          ':phoneQuery': normalized,
        },
        Limit: limit,
        ExclusiveStartKey: this.decodeCursor(cursor),
      }),
    );

    return {
      items: (result.Items as UserEntity[]) ?? [],
      nextCursor: this.encodeCursor(result.LastEvaluatedKey),
    };
  }

  async updateRefreshToken(
    userId: string,
    refreshTokenHash: string,
    refreshTokenExpiresAt: string,
  ): Promise<void> {
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `PROFILE#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET refreshTokenHash = :refreshTokenHash, refreshTokenExpiresAt = :refreshTokenExpiresAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':refreshTokenHash': refreshTokenHash,
          ':refreshTokenExpiresAt': refreshTokenExpiresAt,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `PROFILE#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'REMOVE refreshTokenHash, refreshTokenExpiresAt SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, '').trim();
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
