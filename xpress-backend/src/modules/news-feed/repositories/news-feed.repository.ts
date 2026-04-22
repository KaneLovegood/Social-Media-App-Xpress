import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import {
  PostCommentEntity,
  PostEntity,
  PostIdempotencyEntity,
  PostLikeEntity,
} from '../interfaces/news-feed.interface';

@Injectable()
export class NewsFeedRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async listFeedPage(
    limit: number,
    cursor?: string,
  ): Promise<{ items: PostEntity[]; nextCursor: string | null }> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        FilterExpression: 'entityType = :entityType',
        ExpressionAttributeValues: {
          ':gsi1pk': 'FEED',
          ':entityType': 'POST',
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: this.decodeCursor(cursor),
      }),
    );

    return {
      items: (result.Items as PostEntity[]) ?? [],
      nextCursor: this.encodeCursor(result.LastEvaluatedKey),
    };
  }

  async createPost(item: PostEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
  }

  async getPost(postId: string): Promise<PostEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
      }),
    );

    return (result.Item as PostEntity) ?? null;
  }

  async updatePost(
    postId: string,
    data: {
      content?: string;
      location?: string;
      imageUrls?: string[];
      videoUrls?: string[];
      visibility?: 'public' | 'friends' | 'private';
      sharedFromPostId?: string;
    },
  ): Promise<void> {
    const expressions: string[] = ['updatedAt = :updatedAt'];
    const values: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };

    if (data.content !== undefined) {
      expressions.push('content = :content');
      values[':content'] = data.content;
    }

    if (data.location !== undefined) {
      expressions.push('location = :location');
      values[':location'] = data.location;
    }

    if (data.imageUrls !== undefined) {
      expressions.push('imageUrls = :imageUrls');
      values[':imageUrls'] = data.imageUrls;
    }

    if (data.videoUrls !== undefined) {
      expressions.push('videoUrls = :videoUrls');
      values[':videoUrls'] = data.videoUrls;
    }

    if (data.visibility !== undefined) {
      expressions.push('visibility = :visibility');
      values[':visibility'] = data.visibility;
    }

    if (data.sharedFromPostId !== undefined) {
      expressions.push('sharedFromPostId = :sharedFromPostId');
      values[':sharedFromPostId'] = data.sharedFromPostId;
    }

    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async softDeletePost(postId: string): Promise<void> {
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET isDeleted = :isDeleted, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isDeleted': true,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  async addShareCount(postId: string): Promise<number> {
    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET shareCount = if_not_exists(shareCount, :zero) + :inc, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );

    return Number(result.Attributes?.shareCount ?? 0);
  }

  async hasLike(postId: string, userId: string): Promise<boolean> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `LIKE#${userId}`,
        },
      }),
    );

    return Boolean(result.Item);
  }

  async createLike(postId: string, userId: string): Promise<void> {
    const item: PostLikeEntity = {
      PK: `POST#${postId}`,
      SK: `LIKE#${userId}`,
      entityType: 'POST_LIKE',
      postId,
      userId,
      createdAt: new Date().toISOString(),
    };

    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  async createIdempotencyRecord(
    userId: string,
    idempotencyKey: string,
    postId: string,
  ): Promise<void> {
    const item: PostIdempotencyEntity = {
      PK: `USER#${userId}`,
      SK: `POST_IDEMPOTENCY#${idempotencyKey}`,
      entityType: 'POST_IDEMPOTENCY',
      userId,
      idempotencyKey,
      postId,
      createdAt: new Date().toISOString(),
    };

    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  async getIdempotencyRecord(
    userId: string,
    idempotencyKey: string,
  ): Promise<PostIdempotencyEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `POST_IDEMPOTENCY#${idempotencyKey}`,
        },
      }),
    );

    return (result.Item as PostIdempotencyEntity) ?? null;
  }

  async deleteLike(postId: string, userId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `LIKE#${userId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
  }

  async updateLikeCount(postId: string, delta: 1 | -1): Promise<number> {
    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET likeCount = if_not_exists(likeCount, :zero) + :delta, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':delta': delta,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );

    return Number(result.Attributes?.likeCount ?? 0);
  }

  async createComment(item: PostCommentEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
  }

  async getComment(
    postId: string,
    commentId: string,
  ): Promise<PostCommentEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `COMMENT#${commentId}`,
        },
      }),
    );

    return (result.Item as PostCommentEntity) ?? null;
  }

  async deleteComment(postId: string, commentId: string): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `COMMENT#${commentId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
  }

  async listComments(postId: string, limit = 20): Promise<PostCommentEntity[]> {
    const result = await this.ddbDocClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'entityType = :entityType',
        ExpressionAttributeValues: {
          ':pk': `POST#${postId}`,
          ':sk': 'COMMENT#',
          ':entityType': 'POST_COMMENT',
        },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );

    return (result.Items as PostCommentEntity[]) ?? [];
  }

  async updateCommentCount(postId: string, delta: 1 | -1): Promise<number> {
    const result = await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET commentCount = if_not_exists(commentCount, :zero) + :delta, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':delta': delta,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );

    return Number(result.Attributes?.commentCount ?? 0);
  }

  encodeCursor(lastEvaluatedKey?: Record<string, unknown>): string | null {
    if (!lastEvaluatedKey) return null;
    return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString(
      'base64',
    );
  }

  decodeCursor(cursor?: string): Record<string, unknown> | undefined {
    if (!cursor) return undefined;

    try {
      const json = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}
