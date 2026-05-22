export type PostVisibility = 'public' | 'friends' | 'private';

export interface PostEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'POST';
  postId: string;
  userId: string;
  content: string;
  location?: string;
  imageUrls: string[];
  videoUrls: string[];
  visibility: PostVisibility;
  sharedFromPostId?: string;
  isDeleted: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostIdempotencyEntity {
  PK: string;
  SK: string;
  entityType: 'POST_IDEMPOTENCY';
  userId: string;
  idempotencyKey: string;
  postId: string;
  createdAt: string;
}

export interface PostLikeEntity {
  PK: string;
  SK: string;
  entityType: 'POST_LIKE';
  postId: string;
  userId: string;
  createdAt: string;
}

export interface PostCommentEntity {
  PK: string;
  SK: string;
  entityType: 'POST_COMMENT';
  commentId: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedAuthor {
  userId: string;
  name: string;
  avatarUrl?: string;
}

export interface FeedCommentView {
  commentId: string;
  postId: string;
  userId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  author: FeedAuthor | null;
}

export interface FeedPostView {
  postId: string;
  userId: string;
  content: string;
  location?: string;
  imageUrls: string[];
  videoUrls: string[];
  visibility: PostVisibility;
  sharedFromPostId?: string;
  isDeleted: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
  author: FeedAuthor | null;
  isLikedByMe: boolean;
  comments: FeedCommentView[];
  originalPost?: FeedPostView;
}

export interface BanTinTacGiaView {
  maNguoiDung: string;
  tenNguoiDung: string;
  anhDaiDien?: string;
}

export interface BinhLuanView {
  maBinhLuan: string;
  maBaiViet: string;
  maNguoiDung: string;
  noiDung: string;
  maBinhLuanCha: string | null;
  thoiGianTao: string;
  thoiGianCapNhat: string;
  tacGia: BanTinTacGiaView | null;
}

export interface BaiVietView {
  maBaiViet: string;
  maNguoiDung: string;
  noiDung: string;
  viTri?: string;
  danhSachAnh: string[];
  danhSachVideo: string[];
  cheDoRiengTu: PostVisibility;
  maBaiVietGoc?: string;
  daXoa: boolean;
  soLuotThich: number;
  soBinhLuan: number;
  soLuotChiaSe: number;
  thoiGianTao: string;
  thoiGianCapNhat: string;
  tacGia: BanTinTacGiaView | null;
  daThich: boolean;
  danhSachBinhLuan: BinhLuanView[];
  baiVietGoc?: BaiVietView;
}
