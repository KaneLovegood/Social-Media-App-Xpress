import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import {
  GroupEntity,
  GroupInviteCodeEntity,
  GroupInvitePointerEntity,
  GroupMemberEntity,
  GroupPinEntity,
} from '../interfaces/group.interface';

@Injectable()
export class GroupsRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async createGroup(
    group: GroupEntity,
    ownerMember: GroupMemberEntity,
  ): Promise<void> {
    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: group,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: ownerMember,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
  }

  async findGroupById(groupId: string): Promise<GroupEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `GROUP#${groupId}`,
        },
      }),
    );

    return (result.Item as GroupEntity) ?? null;
  }

  async listGroupsByUserId(userId: string): Promise<GroupMemberEntity[]> {
    const items: GroupMemberEntity[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.ddbDocClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          FilterExpression: 'entityType = :entityType',
          ExpressionAttributeValues: {
            ':gsi1pk': `USER_GROUP#${userId}`,
            ':entityType': 'GROUP_MEMBER',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (Array.isArray(result.Items)) {
        items.push(...(result.Items as GroupMemberEntity[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }

  async findMember(
    groupId: string,
    userId: string,
  ): Promise<GroupMemberEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `MEMBER#${userId}`,
        },
      }),
    );

    return (result.Item as GroupMemberEntity) ?? null;
  }

  async listMembers(groupId: string): Promise<GroupMemberEntity[]> {
    const items: GroupMemberEntity[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.ddbDocClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `GROUP#${groupId}`,
            ':sk': 'MEMBER#',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (Array.isArray(result.Items)) {
        items.push(...(result.Items as GroupMemberEntity[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }

  async addMember(
    group: GroupEntity,
    member: GroupMemberEntity,
  ): Promise<void> {
    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: member,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `GROUP#${group.groupId}`,
                SK: `GROUP#${group.groupId}`,
              },
              ConditionExpression:
                'attribute_exists(PK) AND #version = :version',
              UpdateExpression:
                'SET memberCount = memberCount + :delta, #version = #version + :delta, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#version': 'version',
              },
              ExpressionAttributeValues: {
                ':version': group.version,
                ':delta': 1,
                ':updatedAt': new Date().toISOString(),
              },
            },
          },
        ],
      }),
    );
  }

  async removeMember(group: GroupEntity, userId: string): Promise<void> {
    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.tableName,
              Key: {
                PK: `GROUP#${group.groupId}`,
                SK: `MEMBER#${userId}`,
              },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `GROUP#${group.groupId}`,
                SK: `GROUP#${group.groupId}`,
              },
              ConditionExpression:
                'attribute_exists(PK) AND #version = :version AND memberCount > :zero',
              UpdateExpression:
                'SET memberCount = memberCount - :delta, #version = #version + :delta, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#version': 'version',
              },
              ExpressionAttributeValues: {
                ':version': group.version,
                ':delta': 1,
                ':zero': 0,
                ':updatedAt': new Date().toISOString(),
              },
            },
          },
        ],
      }),
    );
  }

  async deleteMemberRecord(groupId: string, userId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `MEMBER#${userId}`,
        },
      }),
    );
  }

  async deleteGroupRecord(groupId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `GROUP#${groupId}`,
        },
      }),
    );
  }

  async deleteInvitePointer(groupId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: 'INVITE#ACTIVE',
        },
      }),
    );
  }

  async deleteInviteCode(inviteCode: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `INVITE#${inviteCode}`,
          SK: `INVITE#${inviteCode}`,
        },
      }),
    );
  }

  async updateMemberRole(
    groupId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER',
  ): Promise<void> {
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `MEMBER#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET #role = :role, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':role': role,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  async updateMemberNickname(
    groupId: string,
    userId: string,
    nickname?: string,
  ): Promise<void> {
    if (nickname) {
      await this.ddbDocClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: `GROUP#${groupId}`,
            SK: `MEMBER#${userId}`,
          },
          ConditionExpression: 'attribute_exists(PK)',
          UpdateExpression: 'SET nickname = :nickname, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':nickname': nickname,
            ':updatedAt': new Date().toISOString(),
          },
        }),
      );
      return;
    }

    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `MEMBER#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'REMOVE nickname SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  async findInvitePointer(
    groupId: string,
  ): Promise<GroupInvitePointerEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: 'INVITE#ACTIVE',
        },
      }),
    );

    return (result.Item as GroupInvitePointerEntity) ?? null;
  }

  async findInviteByCode(
    inviteCode: string,
  ): Promise<GroupInviteCodeEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `INVITE#${inviteCode}`,
          SK: `INVITE#${inviteCode}`,
        },
      }),
    );

    return (result.Item as GroupInviteCodeEntity) ?? null;
  }

  async saveInvite(
    pointer: GroupInvitePointerEntity,
    codeEntity: GroupInviteCodeEntity,
    previousCode?: string,
  ): Promise<void> {
    const transactItems: NonNullable<
      ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']
    > = [
      {
        Put: {
          TableName: this.tableName,
          Item: codeEntity,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: pointer,
        },
      },
    ];

    if (previousCode && previousCode !== codeEntity.inviteCode) {
      transactItems.push({
        Delete: {
          TableName: this.tableName,
          Key: {
            PK: `INVITE#${previousCode}`,
            SK: `INVITE#${previousCode}`,
          },
        },
      });
    }

    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );
  }

  async pinMessage(item: GroupPinEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async unpinMessage(groupId: string, messageId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `GROUP#${groupId}`,
          SK: `PIN#${messageId}`,
        },
      }),
    );
  }

  async listPins(groupId: string): Promise<GroupPinEntity[]> {
    const items: GroupPinEntity[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.ddbDocClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `GROUP#${groupId}`,
            ':sk': 'PIN#',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (Array.isArray(result.Items)) {
        items.push(...(result.Items as GroupPinEntity[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }
}
