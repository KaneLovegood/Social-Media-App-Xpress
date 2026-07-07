import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  decodeOffsetCursor,
  nextOffsetCursor,
} from '../../../common/mongodb/mongo-repository.utils';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import {
  PostCommentEntity,
  PostEntity,
  PostIdempotencyEntity,
  PostLikeEntity,
} from '../interfaces/news-feed.interface';

@Injectable()
export class NewsFeedRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async listFeedPage(
    limit: number,
    cursor?: string,
  ): Promise<{ items: PostEntity[]; nextCursor: string | null }> {
    const offset = decodeOffsetCursor(cursor);
    const items = await this.itemModel
      .find({
        entityType: 'POST',
        GSI1PK: 'FEED',
      })
      .sort({ GSI1SK: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('-_id')
      .lean<PostEntity[]>()
      .exec();

    return {
      items,
      nextCursor: nextOffsetCursor(offset, items.length, limit),
    };
  }

  async createPost(item: PostEntity): Promise<void> {
    await this.itemModel.create(item);
  }

  async getPost(postId: string): Promise<PostEntity | null> {
    return this.itemModel
      .findOne({
        PK: `POST#${postId}`,
        SK: `POST#${postId}`,
      })
      .select('-_id')
      .lean<PostEntity>()
      .exec();
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
    const set: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    for (const key of [
      'content',
      'location',
      'imageUrls',
      'videoUrls',
      'visibility',
      'sharedFromPostId',
    ] as const) {
      if (data[key] !== undefined) {
        set[key] = data[key];
      }
    }

    await this.itemModel
      .updateOne(
        {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        { $set: set },
      )
      .exec();
  }

  async softDeletePost(postId: string): Promise<void> {
    await this.itemModel
      .updateOne(
        {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        {
          $set: {
            isDeleted: true,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      .exec();
  }

  async addShareCount(postId: string): Promise<number> {
    const updated = await this.itemModel
      .findOneAndUpdate(
        {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        {
          $inc: { shareCount: 1 },
          $set: { updatedAt: new Date().toISOString() },
        },
        { new: true, projection: { _id: 0, shareCount: 1 } },
      )
      .lean<{ shareCount?: number }>()
      .exec();

    return Number(updated?.shareCount ?? 0);
  }

  async hasLike(postId: string, userId: string): Promise<boolean> {
    const item = await this.itemModel
      .exists({
        PK: `POST#${postId}`,
        SK: `LIKE#${userId}`,
      })
      .exec();

    return Boolean(item);
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

    await this.itemModel.create(item);
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

    await this.itemModel.create(item);
  }

  async getIdempotencyRecord(
    userId: string,
    idempotencyKey: string,
  ): Promise<PostIdempotencyEntity | null> {
    return this.itemModel
      .findOne({
        PK: `USER#${userId}`,
        SK: `POST_IDEMPOTENCY#${idempotencyKey}`,
      })
      .select('-_id')
      .lean<PostIdempotencyEntity>()
      .exec();
  }

  async deleteLike(postId: string, userId: string): Promise<void> {
    await this.itemModel
      .deleteOne({
        PK: `POST#${postId}`,
        SK: `LIKE#${userId}`,
      })
      .exec();
  }

  async updateLikeCount(postId: string, delta: 1 | -1): Promise<number> {
    const updated = await this.itemModel
      .findOneAndUpdate(
        {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        {
          $inc: { likeCount: delta },
          $set: { updatedAt: new Date().toISOString() },
        },
        { new: true, projection: { _id: 0, likeCount: 1 } },
      )
      .lean<{ likeCount?: number }>()
      .exec();

    return Number(updated?.likeCount ?? 0);
  }

  async createComment(item: PostCommentEntity): Promise<void> {
    await this.itemModel.create(item);
  }

  async getComment(
    postId: string,
    commentId: string,
  ): Promise<PostCommentEntity | null> {
    return this.itemModel
      .findOne({
        PK: `POST#${postId}`,
        SK: `COMMENT#${commentId}`,
      })
      .select('-_id')
      .lean<PostCommentEntity>()
      .exec();
  }

  async deleteComment(postId: string, commentId: string): Promise<void> {
    await this.itemModel
      .deleteOne({
        PK: `POST#${postId}`,
        SK: `COMMENT#${commentId}`,
      })
      .exec();
  }

  async listComments(postId: string, limit = 20): Promise<PostCommentEntity[]> {
    return this.itemModel
      .find({
        PK: `POST#${postId}`,
        SK: { $regex: '^COMMENT#' },
        entityType: 'POST_COMMENT',
      })
      .sort({ createdAt: 1, commentId: 1 })
      .limit(limit)
      .select('-_id')
      .lean<PostCommentEntity[]>()
      .exec();
  }

  async listCommentsPage(
    postId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: PostCommentEntity[]; nextCursor: string | null }> {
    const offset = decodeOffsetCursor(cursor);
    const items = await this.itemModel
      .find({
        PK: `POST#${postId}`,
        SK: { $regex: '^COMMENT#' },
        entityType: 'POST_COMMENT',
      })
      .sort({ createdAt: 1, commentId: 1 })
      .skip(offset)
      .limit(limit)
      .select('-_id')
      .lean<PostCommentEntity[]>()
      .exec();

    return {
      items,
      nextCursor: nextOffsetCursor(offset, items.length, limit),
    };
  }

  async updateCommentCount(postId: string, delta: 1 | -1): Promise<number> {
    const updated = await this.itemModel
      .findOneAndUpdate(
        {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
        {
          $inc: { commentCount: delta },
          $set: { updatedAt: new Date().toISOString() },
        },
        { new: true, projection: { _id: 0, commentCount: 1 } },
      )
      .lean<{ commentCount?: number }>()
      .exec();

    return Number(updated?.commentCount ?? 0);
  }
}

