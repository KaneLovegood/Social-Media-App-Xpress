import { authFetch } from './auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export type CheDoRiengTu = 'public' | 'friends' | 'private';

export interface TacGiaBanTin {
  maNguoiDung: string;
  tenNguoiDung: string;
  anhDaiDien?: string;
}

export interface BinhLuanBanTin {
  maBinhLuan: string;
  maBaiViet: string;
  maNguoiDung: string;
  noiDung: string;
  maBinhLuanCha: string | null;
  thoiGianTao: string;
  thoiGianCapNhat: string;
  tacGia: TacGiaBanTin | null;
}

export interface BaiVietBanTin {
  maBaiViet: string;
  maNguoiDung: string;
  noiDung: string;
  viTri?: string;
  danhSachAnh: string[];
  danhSachVideo: string[];
  cheDoRiengTu: CheDoRiengTu;
  maBaiVietGoc?: string;
  daXoa: boolean;
  soLuotThich: number;
  soBinhLuan: number;
  soLuotChiaSe: number;
  thoiGianTao: string;
  thoiGianCapNhat: string;
  tacGia: TacGiaBanTin | null;
  daThich: boolean;
  danhSachBinhLuan: BinhLuanBanTin[];
  baiVietGoc?: BaiVietBanTin;
}

interface DanhSachBanTin {
  danhSach: BaiVietBanTin[];
  conTroTiepTheo: string | null;
}

interface KetQuaThich {
  daThich: boolean;
  soLuotThich: number;
}

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE_URL}${path}`, init);
  return parseResponse<T>(response);
}

function toErrorMessage(message: unknown): string {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return 'Da co loi xay ra, vui long thu lai.';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { message?: unknown };
  if (!response.ok) {
    throw new Error(toErrorMessage(data.message));
  }

  return data as T;
}

export async function layDanhSachBanTin(cursor?: string, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  return api<DanhSachBanTin>(`/ban-tin?${params.toString()}`, {
    method: 'GET',
  });
}

export async function taoBaiViet(payload: {
  noiDung?: string;
  viTri?: string;
  danhSachAnh?: string[];
  danhSachVideo?: string[];
  cheDoRiengTu?: CheDoRiengTu;
}) {
  return api<BaiVietBanTin>('/bai-viet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });
}

export async function capNhatBaiViet(
  postId: string,
  payload: {
    noiDung?: string;
    viTri?: string;
    danhSachAnh?: string[];
    danhSachVideo?: string[];
    cheDoRiengTu?: CheDoRiengTu;
  },
) {
  return api<BaiVietBanTin>(`/bai-viet/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function xoaBaiViet(postId: string) {
  return api<{ thanhCong: boolean }>(`/bai-viet/${postId}`, {
    method: 'DELETE',
  });
}

export async function thichBaiViet(postId: string) {
  return api<KetQuaThich>(`/bai-viet/${postId}/thich`, {
    method: 'POST',
  });
}

export async function boThichBaiViet(postId: string) {
  return api<KetQuaThich>(`/bai-viet/${postId}/thich`, {
    method: 'DELETE',
  });
}

export async function themBinhLuan(postId: string, noiDung: string, parentId?: string) {
  return api<BinhLuanBanTin>(`/bai-viet/${postId}/binh-luan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: noiDung, parentId }),
  });
}

export async function xoaBinhLuan(postId: string, commentId: string) {
  return api<{ thanhCong: boolean }>(`/bai-viet/${postId}/binh-luan/${commentId}`, {
    method: 'DELETE',
  });
}

export async function layDanhSachBinhLuan(postId: string, cursor?: string, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  return api<{ items: BinhLuanBanTin[]; nextCursor: string | null }>(`/bai-viet/${postId}/binh-luan?${params.toString()}`, {
    method: 'GET',
  });
}

export async function chiaSeBaiViet(
  postId: string,
  payload?: { noiDung?: string; cheDoRiengTu?: CheDoRiengTu },
) {
  return api<BaiVietBanTin>(`/bai-viet/${postId}/chia-se`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function layChiTietBaiViet(postId: string) {
  return api<BaiVietBanTin>(`/bai-viet/${postId}`, {
    method: 'GET',
  });
}

export async function chiaSeQuaChat(payload: {
  postId: string;
  roomIds: string[];
  noiDung?: string;
}) {
  return api<any>('/chat/share-post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
