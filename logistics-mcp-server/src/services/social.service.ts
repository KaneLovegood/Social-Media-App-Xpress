 import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

export class SocialService {
  private ddbDocClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "ap-southeast-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    this.ddbDocClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.DDB_TABLE_NAME || "Users";
  }

  async searchUserByEmail(email: string, actorUserId: string) {
    const normalizedEmail = email.toLowerCase().trim();
    
    const result = (await this.ddbDocClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "entityType = :entityType AND contains(email, :email)",
        ExpressionAttributeValues: {
          ":entityType": "USER",
          ":email": normalizedEmail,
        },
      }) as any
    )) as any;

    const users = (result.Items || []) as any[];
    
    const items = await Promise.all(
      users.map(async (user) => {
        const friendResult = (await this.ddbDocClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: {
              PK: `USER#${actorUserId}`,
              SK: `FRIEND#${user.userId}`,
            },
          }) as any
        )) as any;
        
        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
          friendStatus: friendResult.Item?.status || "NONE",
        };
      })
    );

    return items;
  }

  async sendFriendRequest(actorUserId: string, targetUserId: string) {
    if (actorUserId === targetUserId) {
      throw new Error("Cannot send friend request to yourself");
    }

    const now = new Date().toISOString();

    const actorItem = {
      PK: `USER#${actorUserId}`,
      SK: `FRIEND#${targetUserId}`,
      entityType: "FRIEND",
      ownerUserId: actorUserId,
      targetUserId,
      status: "PENDING_SENT",
      createdAt: now,
      updatedAt: now,
    };

    const targetItem = {
      PK: `USER#${targetUserId}`,
      SK: `FRIEND#${actorUserId}`,
      entityType: "FRIEND",
      ownerUserId: targetUserId,
      targetUserId: actorUserId,
      status: "PENDING_RECEIVED",
      createdAt: now,
      updatedAt: now,
    };

    await this.ddbDocClient.send(
      new PutCommand({ TableName: this.tableName, Item: actorItem }) as any
    );
    await this.ddbDocClient.send(
      new PutCommand({ TableName: this.tableName, Item: targetItem }) as any
    );

    return { success: true };
  }

  async createGroup(title: string, actorUserId: string) {
    const now = new Date().toISOString();
    const roomId = randomUUID();
    const inviteCode = randomUUID().replace(/-/g, "").slice(0, 12);

    const roomMeta = {
      PK: `ROOM#${roomId}`,
      SK: `META#${roomId}`,
      entityType: "CHAT_GROUP_ROOM",
      roomId,
      roomType: "GROUP",
      title,
      createdByUserId: actorUserId,
      inviteCode,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const creatorRecord = {
      PK: `ROOM#${roomId}`,
      SK: `MEMBER#${actorUserId}`,
      entityType: "CHAT_GROUP_MEMBER",
      roomId,
      userId: actorUserId,
      role: "ADMIN",
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
              Item: roomMeta,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: creatorRecord,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }) as any
    );

    return roomMeta;
  }

  async addMemberToGroup(roomId: string, targetUserId: string, actorUserId: string) {
    // 1. Verify actor is ADMIN
    const adminCheck = (await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${actorUserId}`,
        },
      }) as any
    )) as any;

    if (!adminCheck.Item || adminCheck.Item.role !== "ADMIN") {
      throw new Error("Only ADMIN can add members to group");
    }

    const now = new Date().toISOString();
    const memberRecord = {
      PK: `ROOM#${roomId}`,
      SK: `MEMBER#${targetUserId}`,
      entityType: "CHAT_GROUP_MEMBER",
      roomId,
      userId: targetUserId,
      role: "MEMBER",
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
              Item: memberRecord,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: {
                PK: `ROOM#${roomId}`,
                SK: `META#${roomId}`,
              },
              UpdateExpression: "SET memberCount = memberCount + :step, updatedAt = :updatedAt",
              ExpressionAttributeValues: {
                ":step": 1,
                ":updatedAt": now,
              },
            },
          },
        ],
      }) as any
    );

    return { success: true };
  }

  async listMyGroups(userId: string) {
    const result = (await this.ddbDocClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "entityType = :entityType AND userId = :userId",
        ExpressionAttributeValues: {
          ":entityType": "CHAT_GROUP_MEMBER",
          ":userId": userId,
        },
      }) as any
    )) as any;

    const memberships = (result.Items || []) as any[];
    const rooms = await Promise.all(
      memberships.map(async (m) => {
        const roomResult = (await this.ddbDocClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: {
              PK: `ROOM#${m.roomId}`,
              SK: `META#${m.roomId}`,
            },
          }) as any
        )) as any;
        return { ...m, room: roomResult.Item };
      })
    );

    return rooms;
  }

  async listFriends(userId: string) {
    const result = (await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": "FRIEND#",
        },
      }) as any
    )) as any;

    const friends = (result.Items || []) as any[];
    
    const items = await Promise.all(
      friends.map(async (friend) => {
        const userResult = (await this.ddbDocClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: {
              PK: `USER#${friend.targetUserId}`,
              SK: `PROFILE#${friend.targetUserId}`,
            },
          }) as any
        )) as any;
        
        const userData = userResult.Item || {};
        return {
          userId: friend.targetUserId,
          name: userData.name || "Unknown",
          email: userData.email || "Unknown",
          status: friend.status,
          createdAt: friend.createdAt,
        };
      })
    );

    return items;
  }

  async handleFriendRequest(actorUserId: string, targetUserId: string, action: "ACCEPT" | "REJECT") {
    if (action === "REJECT") {
      await this.ddbDocClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.tableName,
                Key: { PK: `USER#${actorUserId}`, SK: `FRIEND#${targetUserId}` },
              },
            },
            {
              Delete: {
                TableName: this.tableName,
                Key: { PK: `USER#${targetUserId}`, SK: `FRIEND#${actorUserId}` },
              },
            },
          ],
        }) as any
      );
      return { success: true, action: "REJECTED" };
    }

    // ACCEPT
    const now = new Date().toISOString();
    await this.ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `USER#${actorUserId}`, SK: `FRIEND#${targetUserId}` },
              UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: { ":status": "FRIEND", ":updatedAt": now },
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `USER#${targetUserId}`, SK: `FRIEND#${actorUserId}` },
              UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: { ":status": "FRIEND", ":updatedAt": now },
            },
          },
        ],
      }) as any
    );
    return { success: true, action: "ACCEPTED" };
  }

  async getGroupTranscript(roomId: string, actorUserId: string, limit = 15) {
    // 1. Verify membership
    const membership = (await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${actorUserId}`,
        },
      }) as any
    )) as any;

    if (!membership.Item) {
      throw new Error("Access denied: You are not a member of this group room");
    }

    // 2. Query messages via GSI1 index
    const result = (await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `CONVERSATION#${roomId}`,
        },
        ScanIndexForward: false,
        Limit: limit,
      }) as any
    )) as any;

    const messages = (result.Items || []) as any[];
    // Reverse to get proper chronological order
    messages.reverse();

    // 3. Resolve sender names
    const uniqueSenderIds = Array.from(new Set(messages.map((m) => m.senderId)));
    const senderNames: Record<string, string> = {};

    await Promise.all(
      uniqueSenderIds.map(async (senderId) => {
        const userResult = (await this.ddbDocClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: {
              PK: `USER#${senderId}`,
              SK: `PROFILE#${senderId}`,
            },
          }) as any
        )) as any;
        senderNames[senderId] = userResult.Item?.name || "Người dùng ẩn danh";
      })
    );

    // 4. Format transcript
    const formattedTranscript = messages
      .map((m) => {
        const name = senderNames[m.senderId] || "Người dùng ẩn danh";
        const time = new Date(m.createdAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `[${time}] ${name}: ${m.content || "[Hình ảnh/Tệp/Video]"}`;
      })
      .join("\n");

    return {
      roomId,
      messageCount: messages.length,
      transcript: formattedTranscript || "Không có tin nhắn nào trong nhóm này.",
    };
  }
}
