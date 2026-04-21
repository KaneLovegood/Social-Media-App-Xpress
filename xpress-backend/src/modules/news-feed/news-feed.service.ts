import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersRepository } from '../auth/repositories/users.repository';
import { SocialService } from '../social/social.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListFeedDto } from './dto/list-feed.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  BaiVietView,
  BanTinTacGiaView,
  BinhLuanView,
  FeedAuthor,
  FeedCommentView,
  FeedPostView,
  PostCommentEntity,
  PostEntity,
} from './interfaces/news-feed.interface';
import { NewsFeedRepository } from './repositories/news-feed.repository';

@Injectable()
export class NewsFeedService {
  constructor(
    private readonly newsFeedRepository: NewsFeedRepository,
    private readonly usersRepository: UsersRepository,
    private readonly socialService: SocialService,
  ) {}

  async layBanTin(actorUserId: string, dto: ListFeedDto) {
    const limit = dto.limit ?? 10;
    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);

    let cursor = dto.cursor;
    let nextCursor: string | null = null;
    const acceptedPosts: PostEntity[] = [];

    for (let i = 0; i < 5 && acceptedPosts.length < limit; i += 1) {
      const page = await this.newsFeedRepository.listFeedPage(limit * 2, cursor);
      cursor = page.nextCursor ?? undefined;
      nextCursor = page.nextCursor;

      const visibleItems = page.items.filter((item) =>
        this.canViewPost(actorUserId, item, allowedAuthorIds),
      );
      acceptedPosts.push(...visibleItems);

      if (!page.nextCursor) {
        break;
      }
    }

    const deduped = this.deduplicateByPostId(acceptedPosts).slice(0, limit);
    const items = await Promise.all(
      deduped.map((item) => this.toFeedPostView(actorUserId, item)),
    );

    return {
      danhSach: items.map((item) => this.toBaiVietView(item)),
      conTroTiepTheo: nextCursor,
    };
  }

  async taoBaiViet(
    actorUserId: string,
    dto: CreatePostDto,
    idempotencyKey?: string,
  ): Promise<BaiVietView> {
    if (idempotencyKey) {
      const idempotentRecord = await this.newsFeedRepository.getIdempotencyRecord(
        actorUserId,
        idempotencyKey,
      );
      if (idempotentRecord) {
        const post = await this.requirePost(idempotentRecord.postId);
        return this.toBaiVietView(await this.toFeedPostView(actorUserId, post));
      }
    }

    const content = (dto.noiDung ?? '').trim();
    const imageUrls = (dto.danhSachAnh ?? []).filter((item) => item.trim());
    const videoUrls = (dto.danhSachVideo ?? []).filter((item) => item.trim());

    if (!content && imageUrls.length === 0 && videoUrls.length === 0) {
      throw new BadRequestException('Bai viet can co noi dung, anh hoac video');
    }

    const now = new Date().toISOString();
    const postId = randomUUID();

    const post: PostEntity = {
      PK: `POST#${postId}`,
      SK: `POST#${postId}`,
      GSI1PK: 'FEED',
      GSI1SK: `${now}#${postId}`,
      entityType: 'POST',
      postId,
      userId: actorUserId,
      content,
      imageUrls,
      videoUrls,
      visibility: dto.cheDoRiengTu ?? 'friends',
      isDeleted: false,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.newsFeedRepository.createPost(post);

    if (idempotencyKey) {
      try {
        await this.newsFeedRepository.createIdempotencyRecord(
          actorUserId,
          idempotencyKey,
          postId,
        );
      } catch (error) {
        const maybeExisting = await this.newsFeedRepository.getIdempotencyRecord(
          actorUserId,
          idempotencyKey,
        );
        if (maybeExisting) {
          const existingPost = await this.requirePost(maybeExisting.postId);
          return this.toBaiVietView(
            await this.toFeedPostView(actorUserId, existingPost),
          );
        }

        throw error;
      }
    }

    return this.toBaiVietView(await this.toFeedPostView(actorUserId, post));
  }

  async capNhatBaiViet(
    actorUserId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<BaiVietView> {
    const post = await this.requirePost(postId);
    if (post.userId !== actorUserId) {
      throw new ForbiddenException('Ban khong co quyen sua bai viet nay');
    }

    const hasContentUpdate = dto.noiDung !== undefined;
    const hasImageUpdate = dto.danhSachAnh !== undefined;
    const hasVideoUpdate = dto.danhSachVideo !== undefined;

    if (hasContentUpdate || hasImageUpdate || hasVideoUpdate) {
      const content = (dto.noiDung ?? post.content).trim();
      const imageUrls = (dto.danhSachAnh ?? post.imageUrls).filter((item) =>
        item.trim(),
      );
      const videoUrls = (dto.danhSachVideo ?? post.videoUrls).filter((item) =>
        item.trim(),
      );

      if (!content && imageUrls.length === 0 && videoUrls.length === 0) {
        throw new BadRequestException('Bai viet can co noi dung, anh hoac video');
      }
    }

    await this.newsFeedRepository.updatePost(postId, {
      content: dto.noiDung !== undefined ? dto.noiDung.trim() : undefined,
      imageUrls: dto.danhSachAnh,
      videoUrls: dto.danhSachVideo,
      visibility: dto.cheDoRiengTu,
    });

    const updated = await this.requirePost(postId);
    return this.toBaiVietView(await this.toFeedPostView(actorUserId, updated));
  }

  async xoaBaiViet(actorUserId: string, postId: string): Promise<{ thanhCong: boolean }> {
    const post = await this.requirePost(postId);
    if (post.userId !== actorUserId) {
      throw new ForbiddenException('Ban khong co quyen xoa bai viet nay');
    }

    await this.newsFeedRepository.softDeletePost(postId);
    return { thanhCong: true };
  }

  async thichBaiViet(actorUserId: string, postId: string) {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet khong ton tai');
    }

    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);
    if (!this.canViewPost(actorUserId, post, allowedAuthorIds)) {
      throw new ForbiddenException('Ban khong co quyen tuong tac bai viet nay');
    }

    const alreadyLiked = await this.newsFeedRepository.hasLike(postId, actorUserId);
    if (!alreadyLiked) {
      await this.newsFeedRepository.createLike(postId, actorUserId);
      const likeCount = await this.newsFeedRepository.updateLikeCount(postId, 1);
      return { daThich: true, soLuotThich: likeCount };
    }

    const likeCount = Number(post.likeCount ?? 0);
    return { daThich: true, soLuotThich: likeCount };
  }

  async boThichBaiViet(actorUserId: string, postId: string) {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet khong ton tai');
    }

    const alreadyLiked = await this.newsFeedRepository.hasLike(postId, actorUserId);
    if (alreadyLiked) {
      await this.newsFeedRepository.deleteLike(postId, actorUserId);
      const likeCount = await this.newsFeedRepository.updateLikeCount(postId, -1);
      return { daThich: false, soLuotThich: Math.max(0, likeCount) };
    }

    const likeCount = Number(post.likeCount ?? 0);
    return { daThich: false, soLuotThich: likeCount };
  }

  async themBinhLuan(
    actorUserId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<BinhLuanView> {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet khong ton tai');
    }

    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);
    if (!this.canViewPost(actorUserId, post, allowedAuthorIds)) {
      throw new ForbiddenException('Ban khong co quyen binh luan bai viet nay');
    }

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Noi dung binh luan khong duoc de trong');
    }

    const commentId = randomUUID();
    const now = new Date().toISOString();
    const comment: PostCommentEntity = {
      PK: `POST#${postId}`,
      SK: `COMMENT#${commentId}`,
      entityType: 'POST_COMMENT',
      commentId,
      postId,
      userId: actorUserId,
      content,
      parentId: dto.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.newsFeedRepository.createComment(comment);
    await this.newsFeedRepository.updateCommentCount(postId, 1);

    return this.toBinhLuanView(await this.toCommentView(comment));
  }

  async xoaBinhLuan(
    actorUserId: string,
    postId: string,
    commentId: string,
  ): Promise<{ thanhCong: boolean }> {
    await this.requirePost(postId);
    const comment = await this.newsFeedRepository.getComment(postId, commentId);
    if (!comment) {
      throw new NotFoundException('Binh luan khong ton tai');
    }

    if (comment.userId !== actorUserId) {
      throw new ForbiddenException('Ban chi co the xoa binh luan cua minh');
    }

    await this.newsFeedRepository.deleteComment(postId, commentId);
    await this.newsFeedRepository.updateCommentCount(postId, -1);
    return { thanhCong: true };
  }

  async chiaSeBaiViet(actorUserId: string, postId: string, dto: CreatePostDto) {
    const originalPost = await this.requirePost(postId);
    if (originalPost.isDeleted) {
      throw new NotFoundException('Bai viet goc khong ton tai');
    }

    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);
    if (!this.canViewPost(actorUserId, originalPost, allowedAuthorIds)) {
      throw new ForbiddenException('Ban khong the chia se bai viet nay');
    }

    const content = (dto.noiDung ?? '').trim();
    const now = new Date().toISOString();
    const newPostId = randomUUID();

    const sharedPost: PostEntity = {
      PK: `POST#${newPostId}`,
      SK: `POST#${newPostId}`,
      GSI1PK: 'FEED',
      GSI1SK: `${now}#${newPostId}`,
      entityType: 'POST',
      postId: newPostId,
      userId: actorUserId,
      content,
      imageUrls: [],
      videoUrls: [],
      visibility: dto.cheDoRiengTu ?? 'friends',
      sharedFromPostId: originalPost.postId,
      isDeleted: false,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.newsFeedRepository.createPost(sharedPost);
    await this.newsFeedRepository.addShareCount(originalPost.postId);

    return this.toBaiVietView(await this.toFeedPostView(actorUserId, sharedPost));
  }

  private async toFeedPostView(
    actorUserId: string,
    item: PostEntity,
  ): Promise<FeedPostView> {
    const [author, likedByActor, comments] = await Promise.all([
      this.loadAuthor(item.userId),
      this.newsFeedRepository.hasLike(item.postId, actorUserId),
      this.newsFeedRepository.listComments(item.postId, 20),
    ]);

    const viewComments = await Promise.all(
      comments.map((comment) => this.toCommentView(comment)),
    );

    return {
      postId: item.postId,
      userId: item.userId,
      content: item.content,
      imageUrls: item.imageUrls ?? [],
      videoUrls: item.videoUrls ?? [],
      visibility: item.visibility,
      sharedFromPostId: item.sharedFromPostId,
      isDeleted: item.isDeleted,
      likeCount: Math.max(0, Number(item.likeCount ?? 0)),
      commentCount: Math.max(0, Number(item.commentCount ?? 0)),
      shareCount: Math.max(0, Number(item.shareCount ?? 0)),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      author,
      isLikedByMe: likedByActor,
      comments: viewComments,
    };
  }

  private async toCommentView(comment: PostCommentEntity): Promise<FeedCommentView> {
    return {
      commentId: comment.commentId,
      postId: comment.postId,
      userId: comment.userId,
      content: comment.content,
      parentId: comment.parentId ?? null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: await this.loadAuthor(comment.userId),
    };
  }

  private async loadAuthor(userId: string): Promise<FeedAuthor | null> {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      return null;
    }

    return {
      userId: user.userId,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }

  private toTacGiaView(author: FeedAuthor | null): BanTinTacGiaView | null {
    if (!author) {
      return null;
    }

    return {
      maNguoiDung: author.userId,
      tenNguoiDung: author.name,
      anhDaiDien: author.avatarUrl,
    };
  }

  private toBinhLuanView(comment: FeedCommentView): BinhLuanView {
    return {
      maBinhLuan: comment.commentId,
      maBaiViet: comment.postId,
      maNguoiDung: comment.userId,
      noiDung: comment.content,
      maBinhLuanCha: comment.parentId,
      thoiGianTao: comment.createdAt,
      thoiGianCapNhat: comment.updatedAt,
      tacGia: this.toTacGiaView(comment.author),
    };
  }

  private toBaiVietView(item: FeedPostView): BaiVietView {
    return {
      maBaiViet: item.postId,
      maNguoiDung: item.userId,
      noiDung: item.content,
      danhSachAnh: item.imageUrls,
      danhSachVideo: item.videoUrls,
      cheDoRiengTu: item.visibility,
      maBaiVietGoc: item.sharedFromPostId,
      daXoa: item.isDeleted,
      soLuotThich: item.likeCount,
      soBinhLuan: item.commentCount,
      soLuotChiaSe: item.shareCount,
      thoiGianTao: item.createdAt,
      thoiGianCapNhat: item.updatedAt,
      tacGia: this.toTacGiaView(item.author),
      daThich: item.isLikedByMe,
      danhSachBinhLuan: item.comments.map((comment) => this.toBinhLuanView(comment)),
    };
  }

  private async requirePost(postId: string): Promise<PostEntity> {
    const post = await this.newsFeedRepository.getPost(postId);
    if (!post) {
      throw new NotFoundException('Bai viet khong ton tai');
    }

    return post;
  }

  private canViewPost(
    actorUserId: string,
    post: PostEntity,
    allowedAuthorIds: Set<string>,
  ): boolean {
    if (post.isDeleted) {
      return false;
    }

    if (post.userId === actorUserId) {
      return true;
    }

    if (post.visibility === 'public') {
      return true;
    }

    if (post.visibility === 'friends') {
      return allowedAuthorIds.has(post.userId);
    }

    return false;
  }

  private async getAllowedAuthorIds(actorUserId: string): Promise<Set<string>> {
    const friendUsers = await this.socialService.listAllFriendUsers(actorUserId);
    const allowed = new Set<string>([actorUserId]);
    for (const friend of friendUsers) {
      allowed.add(friend.userId);
    }

    return allowed;
  }

  private deduplicateByPostId(items: PostEntity[]): PostEntity[] {
    const map = new Map<string, PostEntity>();
    for (const item of items) {
      if (!map.has(item.postId)) {
        map.set(item.postId, item);
      }
    }

    return Array.from(map.values());
  }
}
