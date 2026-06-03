import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import {
  ChatGroupMemberEntity,
  ChatGroupRoomEntity,
  GroupMemberRole,
} from '../interfaces/group-room.interface';

export interface GroupMemberWithRoom extends ChatGroupMemberEntity {
  room: ChatGroupRoomEntity;
}

@Injectable()
export class GroupRoomsRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async createGroupRoom(input: {
    title: string;
    description?: string;
    avatarUrl?: string;
    emoji?: string;
    createdByUserId: string;
  }): Promise<ChatGroupRoomEntity> {
    const now = new Date().toISOString();
    const roomId = randomUUID();
    const inviteCode = randomUUID().replace(/-/g, '').slice(0, 12);

    const room: ChatGroupRoomEntity = {
      PK: `ROOM#${roomId}`,
      SK: `META#${roomId}`,
      entityType: 'CHAT_GROUP_ROOM',
      roomId,
      roomType: 'GROUP',
      title: input.title,
      description: input.description,
      avatarUrl: input.avatarUrl,
      emoji: input.emoji,
      createdByUserId: input.createdByUserId,
      inviteCode,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const creator: ChatGroupMemberEntity = {
      PK: `ROOM#${roomId}`,
      SK: `MEMBER#${input.createdByUserId}`,
      entityType: 'CHAT_GROUP_MEMBER',
      roomId,
      userId: input.createdByUserId,
      role: 'ADMIN',
      joinedAt: now,
      updatedAt: now,
      lastReadAt: now,
    };

    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: room,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: creator,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );

    return room;
  }

  async findRoomById(roomId: string): Promise<ChatGroupRoomEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        ConsistentRead: true,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `META#${roomId}`,
        },
      }),
    );

    return (result.Item as ChatGroupRoomEntity) ?? null;
  }

  async findRoomByInviteCode(
    inviteCode: string,
  ): Promise<ChatGroupRoomEntity | null> {
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await this.ddbDocClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            'entityType = :entityType AND inviteCode = :inviteCode',
          ExpressionAttributeValues: {
            ':entityType': 'CHAT_GROUP_ROOM',
            ':inviteCode': inviteCode,
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      const room = result.Items?.[0] as ChatGroupRoomEntity | undefined;
      if (room) {
        return room;
      }

      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return null;
  }

  async ensureInviteCode(roomId: string): Promise<ChatGroupRoomEntity> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    if (room.inviteCode) {
      return room;
    }

    const inviteCode = randomUUID().replace(/-/g, '').slice(0, 12);
    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `META#${roomId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET inviteCode = :inviteCode, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inviteCode': inviteCode,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      }),
    );

    return (result.Attributes as ChatGroupRoomEntity) ?? {
      ...room,
      inviteCode,
    };
  }

  async updateRoomMeta(
    roomId: string,
    updates: Partial<
      Pick<
        ChatGroupRoomEntity,
        | 'title'
        | 'description'
        | 'avatarUrl'
        | 'emoji'
        | 'lastMessageAt'
        | 'lastMessagePreview'
        | 'pinnedMessageId'
      >
    >,
  ): Promise<ChatGroupRoomEntity | null> {
    const assignments: string[] = [];
    const values: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      assignments.push('title = :title');
      values[':title'] = updates.title;
    }
    if (updates.description !== undefined) {
      assignments.push('description = :description');
      values[':description'] = updates.description;
    }
    if (updates.avatarUrl !== undefined) {
      assignments.push('avatarUrl = :avatarUrl');
      values[':avatarUrl'] = updates.avatarUrl;
    }
    if (updates.emoji !== undefined) {
      assignments.push('emoji = :emoji');
      values[':emoji'] = updates.emoji;
    }
    if (updates.lastMessageAt !== undefined) {
      assignments.push('lastMessageAt = :lastMessageAt');
      values[':lastMessageAt'] = updates.lastMessageAt;
    }
    if (updates.lastMessagePreview !== undefined) {
      assignments.push('lastMessagePreview = :lastMessagePreview');
      values[':lastMessagePreview'] = updates.lastMessagePreview;
    }
    if (updates.pinnedMessageId !== undefined) {
      assignments.push('pinnedMessageId = :pinnedMessageId');
      values[':pinnedMessageId'] = updates.pinnedMessageId;
    }

    if (assignments.length === 0) {
      return this.findRoomById(roomId);
    }

    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `META#${roomId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: `SET ${assignments.join(', ')}, updatedAt = :updatedAt`,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }),
    );

    return (result.Attributes as ChatGroupRoomEntity) ?? null;
  }

  async listRoomsForUser(userId: string): Promise<GroupMemberWithRoom[]> {
    const result = await this.ddbDocClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :entityType AND userId = :userId',
        ExpressionAttributeValues: {
          ':entityType': 'CHAT_GROUP_MEMBER',
          ':userId': userId,
        },
      }),
    );

    const members = (result.Items as ChatGroupMemberEntity[]) ?? [];
    const loaded = await Promise.all(
      members.map(async (member) => {
        const room = await this.findRoomById(member.roomId);
        if (!room) return null;
        return { ...member, room };
      }),
    );

    return loaded.filter((item): item is GroupMemberWithRoom => item != null);
  }

  async listMembers(roomId: string): Promise<ChatGroupMemberEntity[]> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ROOM#${roomId}`,
          ':skPrefix': 'MEMBER#',
        },
      }),
    );

    return (result.Items as ChatGroupMemberEntity[]) ?? [];
  }

  async findMember(
    roomId: string,
    userId: string,
  ): Promise<ChatGroupMemberEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        ConsistentRead: true,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
      }),
    );

    return (result.Item as ChatGroupMemberEntity) ?? null;
  }

  async addMember(
    roomId: string,
    userId: string,
    role: GroupMemberRole = 'MEMBER',
  ): Promise<ChatGroupMemberEntity> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const existing = await this.findMember(roomId, userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const member: ChatGroupMemberEntity = {
      PK: `ROOM#${roomId}`,
      SK: `MEMBER#${userId}`,
      entityType: 'CHAT_GROUP_MEMBER',
      roomId,
      userId,
      role,
      joinedAt: now,
      updatedAt: now,
      lastReadAt: now,
    };

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
                PK: `ROOM#${roomId}`,
                SK: `META#${roomId}`,
              },
              UpdateExpression:
                'SET memberCount = memberCount + :step, updatedAt = :updatedAt',
              ExpressionAttributeValues: {
                ':step': 1,
                ':updatedAt': now,
              },
            },
          },
        ],
      }),
    );

    return member;
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    const member = await this.findMember(roomId, userId);
    if (!member) {
      return;
    }

    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.tableName,
              Key: {
                PK: `ROOM#${roomId}`,
                SK: `MEMBER#${userId}`,
              },
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `ROOM#${roomId}`,
                SK: `META#${roomId}`,
              },
              UpdateExpression:
                'SET memberCount = memberCount - :step, updatedAt = :updatedAt',
              ExpressionAttributeValues: {
                ':step': 1,
                ':updatedAt': now,
              },
            },
          },
        ],
      }),
    );
  }

  async promoteMember(
    roomId: string,
    userId: string,
  ): Promise<ChatGroupMemberEntity> {
    const current = await this.findMember(roomId, userId);
    if (!current) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET #role = :role, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':role': 'ADMIN',
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );

    return (result.Attributes as ChatGroupMemberEntity) ?? current;
  }

  async transferAdminRole(
    roomId: string,
    fromUserId: string,
    toUserId: string,
  ): Promise<void> {
    const [fromMember, toMember] = await Promise.all([
      this.findMember(roomId, fromUserId),
      this.findMember(roomId, toUserId),
    ]);

    if (!fromMember || !toMember) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `ROOM#${roomId}`,
                SK: `MEMBER#${fromUserId}`,
              },
              ConditionExpression: 'attribute_exists(PK)',
              UpdateExpression:
                'SET #role = :memberRole, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#role': 'role',
              },
              ExpressionAttributeValues: {
                ':memberRole': 'MEMBER',
                ':updatedAt': now,
              },
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `ROOM#${roomId}`,
                SK: `MEMBER#${toUserId}`,
              },
              ConditionExpression: 'attribute_exists(PK)',
              UpdateExpression:
                'SET #role = :adminRole, updatedAt = :updatedAt',
              ExpressionAttributeNames: {
                '#role': 'role',
              },
              ExpressionAttributeValues: {
                ':adminRole': 'ADMIN',
                ':updatedAt': now,
              },
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `ROOM#${roomId}`,
                SK: `META#${roomId}`,
              },
              ConditionExpression: 'attribute_exists(PK)',
              UpdateExpression: 'SET updatedAt = :updatedAt',
              ExpressionAttributeValues: {
                ':updatedAt': now,
              },
            },
          },
        ],
      }),
    );
  }

  async setMemberNickname(
    roomId: string,
    userId: string,
    nickname: string | null,
  ): Promise<ChatGroupMemberEntity | null> {
    const now = new Date().toISOString();
    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          nickname === null
            ? 'REMOVE nickname SET updatedAt = :updatedAt'
            : 'SET nickname = :nickname, updatedAt = :updatedAt',
        ExpressionAttributeValues:
          nickname === null
            ? { ':updatedAt': now }
            : { ':nickname': nickname, ':updatedAt': now },
        ReturnValues: 'ALL_NEW',
      }),
    );

    return (result.Attributes as ChatGroupMemberEntity) ?? null;
  }

  async markMemberRead(roomId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET lastReadAt = :lastReadAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastReadAt': now,
          ':updatedAt': now,
        },
      }),
    );
  }

  async deleteGroupRoom(roomId: string): Promise<string[]> {
    const members = await this.listMembers(roomId);
    const memberUserIds = members.map((member) => member.userId);

    await Promise.all([
      ...members.map((member) =>
        this.ddbDocClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: {
              PK: `ROOM#${roomId}`,
              SK: `MEMBER#${member.userId}`,
            },
          }),
        ),
      ),
      this.ddbDocClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: `ROOM#${roomId}`,
            SK: `META#${roomId}`,
          },
        }),
      ),
    ]);

    return memberUserIds;
  }
}
