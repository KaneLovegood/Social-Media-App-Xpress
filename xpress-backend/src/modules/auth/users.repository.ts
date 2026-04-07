import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { User } from './types/user.type';

@Injectable()
export class UsersRepository {
  private readonly tableName = process.env.USERS_TABLE ?? 'users';
  private readonly docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  async findByPhone(phone: string): Promise<User | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'phone-index',
        KeyConditionExpression: 'phone = :phone',
        ExpressionAttributeValues: {
          ':phone': phone,
        },
        Limit: 1,
      }),
    );

    return (result.Items?.[0] as User | undefined) ?? null;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId },
      }),
    );

    return (result.Item as User | undefined) ?? null;
  }

  async create(user: User): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
        ConditionExpression: 'attribute_not_exists(userId)',
      }),
    );
  }
}
