import { Inject, Injectable } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import { SessionEntity } from '../interfaces/session.interface';

@Injectable()
export class SessionRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async createSession(session: SessionEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: session,
        ConditionExpression:
          'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  async findSessionById(
    userId: string,
    sessionId: string,
  ): Promise<SessionEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `USER#${userId}`, SK: `SESSION#${sessionId}` },
      }),
    );
    return (result.Item as SessionEntity) ?? null;
  }

  async findActiveSessionByFingerprint(
    userId: string,
    deviceFingerprintHash: string,
  ): Promise<SessionEntity | null> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression:
          'entityType = :entityType AND deviceFingerprintHash = :fingerprint AND #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': 'SESSION#',
          ':entityType': 'SESSION',
          ':fingerprint': deviceFingerprintHash,
          ':status': 'ACTIVE',
        },
        Limit: 1,
      }),
    );
    return (result.Items?.[0] as SessionEntity) ?? null;
  }

  async findActiveSessions(userId: string): Promise<SessionEntity[]> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'entityType = :entityType AND #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': 'SESSION#',
          ':entityType': 'SESSION',
          ':status': 'ACTIVE',
        },
      }),
    );

    return (result.Items as SessionEntity[] | undefined) ?? [];
  }

  async updateSessionRefreshToken(
    userId: string,
    sessionId: string,
    refreshTokenHash: string,
    refreshTokenExpiresAt: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `USER#${userId}`, SK: `SESSION#${sessionId}` },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET refreshTokenHash = :refreshTokenHash, refreshTokenExpiresAt = :refreshTokenExpiresAt, lastSeenAt = :lastSeenAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':refreshTokenHash': refreshTokenHash,
          ':refreshTokenExpiresAt': refreshTokenExpiresAt,
          ':lastSeenAt': now,
          ':updatedAt': now,
        },
      }),
    );
  }

  async deactivateSession(userId: string, sessionId: string): Promise<void> {
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `USER#${userId}`, SK: `SESSION#${sessionId}` },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'INACTIVE',
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }
}
