import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
    @Inject(forwardRef(() => SocialService))
    private readonly socialService: SocialService,
  ) {}

  async layBanTin(actorUserId: string, dto: ListFeedDto) {
    const limit = dto.limit ?? 10;
    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);

    let cursor = dto.cursor;
    let nextCursor: string | null = null;
    const acceptedPosts: PostEntity[] = [];

    for (let i = 0; i < 5 && acceptedPosts.length < limit; i += 1) {
      const page = await this.newsFeedRepository.listFeedPage(
        limit * 2,
        cursor,
      );
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
      const idempotentRecord =
        await this.newsFeedRepository.getIdempotencyRecord(
          actorUserId,
          idempotencyKey,
        );
      if (idempotentRecord) {
        const post = await this.requirePost(idempotentRecord.postId);
        return this.toBaiVietView(await this.toFeedPostView(actorUserId, post));
      }
    }

    const content = (dto.noiDung ?? '').trim();
    const location = (dto.viTri ?? '').trim();
    const imageUrls = (dto.danhSachAnh ?? []).filter((item) => item.trim());
    const videoUrls = (dto.danhSachVideo ?? []).filter((item) => item.trim());

    if (
      !content &&
      !location &&
      imageUrls.length === 0 &&
      videoUrls.length === 0
    ) {
      throw new BadRequestException(
        'Bai viet can co noi dung, vi tri, anh hoac video',
      );
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
      location,
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
        const maybeExisting =
          await this.newsFeedRepository.getIdempotencyRecord(
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
    const hasLocationUpdate = dto.viTri !== undefined;
    const hasImageUpdate = dto.danhSachAnh !== undefined;
    const hasVideoUpdate = dto.danhSachVideo !== undefined;

    if (
      hasContentUpdate ||
      hasLocationUpdate ||
      hasImageUpdate ||
      hasVideoUpdate
    ) {
      const content = (dto.noiDung ?? post.content).trim();
      const location = (dto.viTri ?? post.location ?? '').trim();
      const imageUrls = (dto.danhSachAnh ?? post.imageUrls).filter((item) =>
        item.trim(),
      );
      const videoUrls = (dto.danhSachVideo ?? post.videoUrls).filter((item) =>
        item.trim(),
      );

      if (
        !content &&
        !location &&
        imageUrls.length === 0 &&
        videoUrls.length === 0
      ) {
        throw new BadRequestException(
          'Bai viet can co noi dung, vi tri, anh hoac video',
        );
      }
    }

    await this.newsFeedRepository.updatePost(postId, {
      content: dto.noiDung !== undefined ? dto.noiDung.trim() : undefined,
      location: dto.viTri !== undefined ? dto.viTri.trim() : undefined,
      imageUrls: dto.danhSachAnh,
      videoUrls: dto.danhSachVideo,
      visibility: dto.cheDoRiengTu,
    });

    const updated = await this.requirePost(postId);
    return this.toBaiVietView(await this.toFeedPostView(actorUserId, updated));
  }

  async xoaBaiViet(
    actorUserId: string,
    postId: string,
  ): Promise<{ thanhCong: boolean }> {
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

    const alreadyLiked = await this.newsFeedRepository.hasLike(
      postId,
      actorUserId,
    );
    let likeCount = Number(post.likeCount ?? 0);
    if (!alreadyLiked) {
      await this.newsFeedRepository.createLike(postId, actorUserId);
      likeCount = await this.newsFeedRepository.updateLikeCount(postId, 1);
    }

    const actor = await this.usersRepository.findByUserId(actorUserId);

    return {
      daThich: true,
      soLuotThich: likeCount,
      postUserId: post.userId,
      nguoiTuongTac: actor
        ? {
            maNguoiDung: actor.userId,
            tenNguoiDung: actor.name,
            anhDaiDien: actor.avatarUrl,
          }
        : null,
    };
  }

  async boThichBaiViet(actorUserId: string, postId: string) {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet khong ton tai');
    }

    const alreadyLiked = await this.newsFeedRepository.hasLike(
      postId,
      actorUserId,
    );
    let likeCount = Number(post.likeCount ?? 0);
    if (alreadyLiked) {
      await this.newsFeedRepository.deleteLike(postId, actorUserId);
      likeCount = await this.newsFeedRepository.updateLikeCount(postId, -1);
    }

    const actor = await this.usersRepository.findByUserId(actorUserId);

    return {
      daThich: false,
      soLuotThich: Math.max(0, likeCount),
      postUserId: post.userId,
      nguoiTuongTac: actor
        ? {
            maNguoiDung: actor.userId,
            tenNguoiDung: actor.name,
            anhDaiDien: actor.avatarUrl,
          }
        : null,
    };
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

    if (originalPost.sharedFromPostId) {
      throw new BadRequestException(
        'Khong the chia se lai bai viet da duoc chia se (gioi han 2 cap)',
      );
    }

    if (originalPost.visibility === 'private') {
      throw new ForbiddenException(
        'Khong the chia se bai viet o che do rieng tu',
      );
    }

    let visibility = dto.cheDoRiengTu ?? 'friends';
    if (originalPost.visibility === 'friends') {
      visibility = 'friends';
    }

    const content = (dto.noiDung ?? '').trim();
    const location = (dto.viTri ?? '').trim();
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
      location,
      imageUrls: [],
      videoUrls: [],
      visibility,
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

    return this.toBaiVietView(
      await this.toFeedPostView(actorUserId, sharedPost),
    );
  }

  async layChiTietBaiViet(
    actorUserId: string,
    postId: string,
  ): Promise<BaiVietView> {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet da bi xoa');
    }

    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);
    if (!this.canViewPost(actorUserId, post, allowedAuthorIds)) {
      throw new ForbiddenException('Ban khong co quyen xem bai viet nay');
    }

    const feedPostView = await this.toFeedPostView(actorUserId, post);
    return this.toBaiVietView(feedPostView);
  }

  async tangLuotChiaSe(postId: string): Promise<PostEntity> {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet khong ton tai');
    }
    const newShareCount = await this.newsFeedRepository.addShareCount(postId);
    post.shareCount = newShareCount;
    return post;
  }

  private async toFeedPostView(
    actorUserId: string,
    item: PostEntity,
    depth = 0,
  ): Promise<FeedPostView> {
    const [author, likedByActor, comments] = await Promise.all([
      this.loadAuthor(item.userId),
      this.newsFeedRepository.hasLike(item.postId, actorUserId),
      this.newsFeedRepository.listComments(item.postId, 100),
    ]);

    // Sort comments chronologically (oldest first)
    const sortedComments = [...comments].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    let commentsToReturn = sortedComments;
    if (sortedComments.length > 10) {
      commentsToReturn = sortedComments.slice(-5);
    }

    const viewComments = await Promise.all(
      commentsToReturn.map((comment) => this.toCommentView(comment)),
    );

    let originalPost: FeedPostView | undefined = undefined;
    if (item.sharedFromPostId && depth === 0) {
      const origPostEntity = await this.newsFeedRepository.getPost(
        item.sharedFromPostId,
      );
      if (origPostEntity) {
        originalPost = await this.toFeedPostView(
          actorUserId,
          origPostEntity,
          1,
        );
      }
    }

    return {
      postId: item.postId,
      userId: item.userId,
      content: item.content,
      location: item.location,
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
      originalPost,
    };
  }

  async layDanhSachBinhLuan(
    actorUserId: string,
    postId: string,
    limit = 20,
    cursor?: string,
  ) {
    const post = await this.requirePost(postId);
    if (post.isDeleted) {
      throw new NotFoundException('Bai viet khong ton tai');
    }

    const allowedAuthorIds = await this.getAllowedAuthorIds(actorUserId);
    if (!this.canViewPost(actorUserId, post, allowedAuthorIds)) {
      throw new ForbiddenException(
        'Ban khong co quyen xem binh luan cua bai viet nay',
      );
    }

    const page = await this.newsFeedRepository.listCommentsPage(
      postId,
      limit,
      cursor,
    );

    // Sort chronologically (oldest first)
    const sortedComments = [...page.items].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const items = await Promise.all(
      sortedComments.map((comment) => this.toCommentView(comment)),
    );

    return {
      items: items.map((comment) => this.toBinhLuanView(comment)),
      nextCursor: page.nextCursor,
    };
  }

  private async toCommentView(
    comment: PostCommentEntity,
  ): Promise<FeedCommentView> {
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
      viTri: item.location,
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
      danhSachBinhLuan: item.comments.map((comment) =>
        this.toBinhLuanView(comment),
      ),
      baiVietGoc: item.originalPost
        ? this.toBaiVietView(item.originalPost)
        : undefined,
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
    const friendUsers =
      await this.socialService.listAllFriendUsers(actorUserId);
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
