"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  BaiVietBanTin,
  boThichBaiViet,
  capNhatBaiViet,
  chiaSeBaiViet,
  CheDoRiengTu,
  layDanhSachBanTin,
  taoBaiViet,
  themBinhLuan,
  thichBaiViet,
  xoaBaiViet,
  xoaBinhLuan,
} from '@/lib/news-feed';
import { getStoredUser, getValidAccessToken } from '@/lib/auth-client';
import { getPresignedUrl, uploadFileToS3 } from '@/lib/chat-upload';
import { createFeedSocket } from '@/lib/realtime/socket-client';
import { FEED_EVENTS } from '@/lib/realtime/events';
import {
  Bell,
  ImageIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Search,
  Share2,
  Smile,
  ThumbsUp,
  UserPlus,
} from 'lucide-react';

function dinhDangThoiGian(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function Avatar({ tenNguoiDung, anhDaiDien }: { tenNguoiDung: string; anhDaiDien?: string }) {
  const initials = useMemo(() => {
    const parts = tenNguoiDung.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }, [tenNguoiDung]);

  if (anhDaiDien) {
    return (
      <img
        src={anhDaiDien}
        alt={tenNguoiDung}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dae2ff] font-semibold text-[#0a4cc8]">
      {initials}
    </div>
  );
}

function LazyVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hienThiNguon, setHienThiNguon] = useState(false);
  const [dangTuDongPhat, setDangTuDongPhat] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHienThiNguon(true);
          void element.play().then(
            () => setDangTuDongPhat(true),
            () => setDangTuDongPhat(false),
          );
          return;
        }

        element.pause();
        setDangTuDongPhat(false);
      },
      { threshold: 0.4 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-[#d7dff5] bg-black">
      <video
        ref={ref}
        controls
        muted
        playsInline
        preload="none"
        className="h-56 w-full object-cover"
      >
        {hienThiNguon ? <source src={src} /> : null}
      </video>
      <div className="flex items-center justify-between bg-[#0e1320] px-3 py-1 text-xs text-white">
        <span>Video</span>
        <span>{dangTuDongPhat ? 'Dang phat' : 'Tam dung'}</span>
      </div>
    </div>
  );
}

export default function NewsFeedPage() {
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.userId ?? '';

  const [danhSachBaiViet, setDanhSachBaiViet] = useState<BaiVietBanTin[]>([]);
  const [conTroTiepTheo, setConTroTiepTheo] = useState<string | null>(null);
  const [dangTaiBanTin, setDangTaiBanTin] = useState(true);
  const [dangTaiThem, setDangTaiThem] = useState(false);
  const [dangDangBai, setDangDangBai] = useState(false);
  const [loi, setLoi] = useState('');

  const [noiDung, setNoiDung] = useState('');
  const [cheDoRiengTu, setCheDoRiengTu] = useState<CheDoRiengTu>('friends');
  const [anhDaChon, setAnhDaChon] = useState<File[]>([]);
  const [videoDaChon, setVideoDaChon] = useState<File[]>([]);
  const [binhLuanNhap, setBinhLuanNhap] = useState<Record<string, string>>({});

  const loadBanTin = async (cursor?: string) => {
    const page = await layDanhSachBanTin(cursor);
    if (cursor) {
      setDanhSachBaiViet((prev) => {
        const merged = [...prev, ...page.danhSach];
        const map = new Map(merged.map((item) => [item.maBaiViet, item]));
        return Array.from(map.values());
      });
    } else {
      setDanhSachBaiViet(page.danhSach);
    }

    setConTroTiepTheo(page.conTroTiepTheo);
  };

  useEffect(() => {
    void (async () => {
      setDangTaiBanTin(true);
      setLoi('');
      try {
        await loadBanTin();
      } catch (error) {
        setLoi(error instanceof Error ? error.message : 'Khong tai duoc ban tin');
      } finally {
        setDangTaiBanTin(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void getValidAccessToken().then((token) => {
      if (!token || cancelled) return;

      const socket = createFeedSocket(token);

      const onPostCreated = (payload: BaiVietBanTin) => {
        setDanhSachBaiViet((prev) => [
          payload,
          ...prev.filter((item) => item.maBaiViet !== payload.maBaiViet),
        ]);
      };

      const onPostUpdated = (payload: BaiVietBanTin) => {
        setDanhSachBaiViet((prev) =>
          prev.map((item) => (item.maBaiViet === payload.maBaiViet ? payload : item)),
        );
      };

      const onPostDeleted = (payload: { maBaiViet: string }) => {
        setDanhSachBaiViet((prev) =>
          prev.filter((item) => item.maBaiViet !== payload.maBaiViet),
        );
      };

      const onReactionUpdated = (payload: {
        maBaiViet: string;
        daThich: boolean;
        soLuotThich: number;
      }) => {
        setDanhSachBaiViet((prev) =>
          prev.map((item) =>
            item.maBaiViet === payload.maBaiViet
              ? {
                  ...item,
                  soLuotThich: payload.soLuotThich,
                }
              : item,
          ),
        );
      };

      const onCommentCreated = (payload: {
        maBinhLuan: string;
        maBaiViet: string;
        maNguoiDung: string;
        noiDung: string;
        maBinhLuanCha: string | null;
        thoiGianTao: string;
        thoiGianCapNhat: string;
        tacGia: {
          maNguoiDung: string;
          tenNguoiDung: string;
          anhDaiDien?: string;
        } | null;
      }) => {
        setDanhSachBaiViet((prev) =>
          prev.map((item) =>
            item.maBaiViet === payload.maBaiViet
              ? item.danhSachBinhLuan.some(
                  (binhLuan) => binhLuan.maBinhLuan === payload.maBinhLuan,
                )
                ? item
                : {
                    ...item,
                    soBinhLuan: item.soBinhLuan + 1,
                    danhSachBinhLuan: [...item.danhSachBinhLuan, payload],
                  }
              : item,
          ),
        );
      };

      const onCommentDeleted = (payload: { maBaiViet: string; maBinhLuan: string }) => {
        setDanhSachBaiViet((prev) =>
          prev.map((item) => {
            if (item.maBaiViet !== payload.maBaiViet) return item;
            const existed = item.danhSachBinhLuan.some(
              (binhLuan) => binhLuan.maBinhLuan === payload.maBinhLuan,
            );
            return {
              ...item,
              soBinhLuan: existed ? Math.max(0, item.soBinhLuan - 1) : item.soBinhLuan,
              danhSachBinhLuan: item.danhSachBinhLuan.filter(
                (binhLuan) => binhLuan.maBinhLuan !== payload.maBinhLuan,
              ),
            };
          }),
        );
      };

      socket.on(FEED_EVENTS.POST_CREATED, onPostCreated);
      socket.on(FEED_EVENTS.POST_UPDATED, onPostUpdated);
      socket.on(FEED_EVENTS.POST_DELETED, onPostDeleted);
      socket.on(FEED_EVENTS.REACTION_UPDATED, onReactionUpdated);
      socket.on(FEED_EVENTS.COMMENT_CREATED, onCommentCreated);
      socket.on(FEED_EVENTS.COMMENT_DELETED, onCommentDeleted);

      cleanup = () => {
        socket.off(FEED_EVENTS.POST_CREATED, onPostCreated);
        socket.off(FEED_EVENTS.POST_UPDATED, onPostUpdated);
        socket.off(FEED_EVENTS.POST_DELETED, onPostDeleted);
        socket.off(FEED_EVENTS.REACTION_UPDATED, onReactionUpdated);
        socket.off(FEED_EVENTS.COMMENT_CREATED, onCommentCreated);
        socket.off(FEED_EVENTS.COMMENT_DELETED, onCommentDeleted);
        socket.disconnect();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const onChonAnh = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setAnhDaChon(files);
  };

  const onChonVideo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setVideoDaChon(files);
  };

  const uploadDanhSachFile = async (files: File[]) => {
    const urls: string[] = [];

    for (const file of files) {
      const presigned = await getPresignedUrl(file.name, file.type, file.size);
      await uploadFileToS3(presigned.uploadUrl, file);
      urls.push(presigned.publicUrl);
    }

    return urls;
  };

  const onDangBai = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!noiDung.trim() && anhDaChon.length === 0 && videoDaChon.length === 0) {
      setLoi('Bai viet can co noi dung, anh hoac video.');
      return;
    }

    setDangDangBai(true);
    setLoi('');

    try {
      const [danhSachAnh, danhSachVideo] = await Promise.all([
        uploadDanhSachFile(anhDaChon),
        uploadDanhSachFile(videoDaChon),
      ]);

      const baiMoi = await taoBaiViet({
        noiDung,
        danhSachAnh,
        danhSachVideo,
        cheDoRiengTu,
      });

      setDanhSachBaiViet((prev) => [baiMoi, ...prev]);
      setNoiDung('');
      setAnhDaChon([]);
      setVideoDaChon([]);
      setCheDoRiengTu('friends');
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Dang bai that bai');
    } finally {
      setDangDangBai(false);
    }
  };

  const onThich = async (post: BaiVietBanTin) => {
    try {
      const result = post.daThich
        ? await boThichBaiViet(post.maBaiViet)
        : await thichBaiViet(post.maBaiViet);

      setDanhSachBaiViet((prev) =>
        prev.map((item) =>
          item.maBaiViet === post.maBaiViet
            ? {
                ...item,
                daThich: result.daThich,
                soLuotThich: result.soLuotThich,
              }
            : item,
        ),
      );
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Khong cap nhat duoc luot thich');
    }
  };

  const onThemBinhLuan = async (maBaiViet: string) => {
    const noiDungBinhLuan = (binhLuanNhap[maBaiViet] ?? '').trim();
    if (!noiDungBinhLuan) return;

    try {
      await themBinhLuan(maBaiViet, noiDungBinhLuan);
      setBinhLuanNhap((prev) => ({ ...prev, [maBaiViet]: '' }));
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Them binh luan that bai');
    }
  };

  const onXoaBinhLuan = async (maBaiViet: string, maBinhLuan: string) => {
    try {
      await xoaBinhLuan(maBaiViet, maBinhLuan);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Xoa binh luan that bai');
    }
  };

  const onSuaBaiViet = async (post: BaiVietBanTin) => {
    const noiDungMoi = window.prompt('Cap nhat noi dung bai viet', post.noiDung);
    if (noiDungMoi == null) return;

    try {
      const updated = await capNhatBaiViet(post.maBaiViet, { noiDung: noiDungMoi });
      setDanhSachBaiViet((prev) =>
        prev.map((item) => (item.maBaiViet === updated.maBaiViet ? updated : item)),
      );
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Cap nhat bai viet that bai');
    }
  };

  const onXoaBaiViet = async (maBaiViet: string) => {
    if (!window.confirm('Ban co chac chan muon xoa bai viet?')) return;

    try {
      await xoaBaiViet(maBaiViet);
      setDanhSachBaiViet((prev) => prev.filter((item) => item.maBaiViet !== maBaiViet));
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Xoa bai viet that bai');
    }
  };

  const onChiaSe = async (post: BaiVietBanTin) => {
    const ghiChu = window.prompt('Them noi dung khi chia se (co the bo trong)', '');
    if (ghiChu == null) return;

    try {
      const result = await chiaSeBaiViet(post.maBaiViet, { noiDung: ghiChu });
      setDanhSachBaiViet((prev) => [result, ...prev]);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Chia se bai viet that bai');
    }
  };

  const onTaiThem = async () => {
    if (!conTroTiepTheo) return;
    setDangTaiThem(true);
    try {
      await loadBanTin(conTroTiepTheo);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Khong tai them du lieu');
    } finally {
      setDangTaiThem(false);
    }
  };

  const goiYKetBan = [
    { ten: 'Tuan Hai', moTa: 'Goi y cho ban' },
    { ten: 'Ngoc Mai', moTa: 'Ban chung: 5' },
    { ten: 'Bao Chau', moTa: 'Ban chung: 2' },
  ];

  const xuHuong = [
    { tag: '#DesignSystem', tieuDe: 'Xu huong thiet ke 2026', soBaiViet: '1.2K bai viet' },
    { tag: '#AtriumConnect', tieuDe: 'Su kien ra mat ung dung', soBaiViet: '850 bai viet' },
    { tag: '#TechNews', tieuDe: 'AI va tuong lai cua Chat', soBaiViet: '2.4K bai viet' },
  ];

  if (!currentUser) {
    return (
      <section className="mx-auto flex h-full w-full max-w-3xl items-center justify-center px-4 py-8">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Khong tim thay phien dang nhap. Vui long dang nhap lai.
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-full w-full flex-col overflow-hidden bg-[#f3f4f6]">
      <header className="flex h-16 items-center justify-between border-b border-[#dce0eb] bg-[#f3f4f6] px-4 md:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          <h1 className="bg-linear-to-r from-[#0052cc] to-[#0068ff] bg-clip-text text-xl font-black text-transparent">
            Ban tin
          </h1>
          <div className="hidden items-center rounded-full bg-white px-4 py-2 ring-1 ring-[#d8ddea] md:flex md:w-80">
            <Search size={16} className="mr-2 text-[#8b91a4]" />
            <input
              type="text"
              placeholder="Tim kiem bai viet..."
              className="w-full border-none bg-transparent p-0 text-sm outline-none placeholder:text-[#8b91a4]"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full p-2 text-[#5c647a] transition-colors hover:bg-[#e4e8f2]"
          >
            <UserPlus size={18} />
          </button>
          <button
            type="button"
            className="relative rounded-full p-2 text-[#5c647a] transition-colors hover:bg-[#e4e8f2]"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ba1a1a]" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <form onSubmit={onDangBai} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#dce0eb]">
              <div className="flex gap-3">
                <Avatar tenNguoiDung={currentUser.name} anhDaiDien={currentUser.avatarUrl} />
                <textarea
                  value={noiDung}
                  onChange={(event) => setNoiDung(event.target.value)}
                  rows={3}
                  placeholder="Ban dang nghi gi?"
                  className="w-full resize-none rounded-2xl border border-[#d6dceb] bg-[#f8f9fb] px-4 py-2 text-sm outline-none placeholder:text-[#8b91a4] focus:border-[#5c84da]"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e8ecf5] pt-3">
                <div className="flex flex-wrap items-center gap-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]">
                    <ImageIcon size={16} className="text-[#0068ff]" />
                    Anh/Video ({anhDaChon.length + videoDaChon.length})
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        const images = files.filter((file) => file.type.startsWith('image/'));
                        const videos = files.filter((file) => file.type.startsWith('video/'));
                        setAnhDaChon(images);
                        setVideoDaChon(videos);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
                  >
                    <Smile size={16} className="text-[#a33500]" />
                    Cam xuc
                  </button>

                  <button
                    type="button"
                    className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa] sm:flex"
                  >
                    <MapPin size={16} className="text-[#425c9f]" />
                    Vi tri
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={cheDoRiengTu}
                    onChange={(event) => setCheDoRiengTu(event.target.value as CheDoRiengTu)}
                    className="h-10 rounded-full border border-[#d7dcec] bg-white px-3 text-xs font-semibold text-[#4f5870]"
                  >
                    <option value="public">Cong khai</option>
                    <option value="friends">Ban be</option>
                    <option value="private">Rieng tu</option>
                  </select>

                  <button
                    type="submit"
                    disabled={dangDangBai}
                    className="rounded-full bg-linear-to-r from-[#0052cc] to-[#0068ff] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-60"
                  >
                    {dangDangBai ? 'Dang tai...' : 'Dang'}
                  </button>
                </div>
              </div>
            </form>

            {loi ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {loi}
              </p>
            ) : null}

            {dangTaiBanTin ? (
              <div className="rounded-xl bg-white p-5 text-sm text-[#6c7899] shadow-sm ring-1 ring-[#dce0eb]">
                Dang tai ban tin...
              </div>
            ) : null}

            {!dangTaiBanTin && danhSachBaiViet.length === 0 ? (
              <div className="rounded-xl bg-white p-5 text-sm text-[#6c7899] shadow-sm ring-1 ring-[#dce0eb]">
                Chua co bai viet nao.
              </div>
            ) : null}

            {danhSachBaiViet.map((baiViet) => (
              <article
                key={baiViet.maBaiViet}
                className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#dce0eb] transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      tenNguoiDung={baiViet.tacGia?.tenNguoiDung ?? 'Nguoi dung'}
                      anhDaiDien={baiViet.tacGia?.anhDaiDien}
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#191c1e]">
                        {baiViet.tacGia?.tenNguoiDung ?? 'Nguoi dung'}
                      </h2>
                      <p className="text-xs text-[#727687]">{dinhDangThoiGian(baiViet.thoiGianTao)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-full p-2 text-[#6b7387] transition-colors hover:bg-[#eef2fa]"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                {baiViet.noiDung ? (
                  <p className="px-4 pb-3 whitespace-pre-wrap text-sm leading-relaxed text-[#191c1e]">
                    {baiViet.noiDung}
                  </p>
                ) : null}

                {baiViet.danhSachAnh.length > 0 ? (
                  <div className={`grid gap-1 ${baiViet.danhSachAnh.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {baiViet.danhSachAnh.map((anh) => (
                      <img
                        key={anh}
                        src={anh}
                        alt="Anh bai viet"
                        loading="lazy"
                        className="h-64 w-full object-cover"
                      />
                    ))}
                  </div>
                ) : null}

                {baiViet.danhSachVideo.length > 0 ? (
                  <div className="space-y-2 p-4 pt-3">
                    {baiViet.danhSachVideo.map((video) => (
                      <LazyVideo key={video} src={video} />
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-[#edf1f8] px-4 py-2 text-xs text-[#727687]">
                  <span>{baiViet.soLuotThich} luot thich</span>
                  <span>
                    {baiViet.soBinhLuan} binh luan • {baiViet.soLuotChiaSe} chia se
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 border-t border-[#edf1f8] p-1">
                  <button
                    type="button"
                    onClick={() => void onThich(baiViet)}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                      baiViet.daThich
                        ? 'bg-[#e7efff] text-[#0052cc]'
                        : 'text-[#4f5870] hover:bg-[#eef2fa]'
                    }`}
                  >
                    <ThumbsUp size={16} />
                    {baiViet.daThich ? 'Bo thich' : 'Thich'}
                  </button>

                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
                  >
                    <MessageCircle size={16} />
                    Binh luan
                  </button>

                  <button
                    type="button"
                    onClick={() => void onChiaSe(baiViet)}
                    className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
                  >
                    <Share2 size={16} />
                    Chia se
                  </button>
                </div>

                <div className="space-y-2 bg-[#f8f9fb] p-3">
                  {baiViet.maNguoiDung === currentUserId ? (
                    <div className="flex gap-2 pb-1">
                      <button
                        type="button"
                        onClick={() => void onSuaBaiViet(baiViet)}
                        className="rounded-md bg-[#edf6ea] px-3 py-1.5 text-xs font-semibold text-[#2d7f34]"
                      >
                        Sua
                      </button>
                      <button
                        type="button"
                        onClick={() => void onXoaBaiViet(baiViet.maBaiViet)}
                        className="rounded-md bg-[#ffecee] px-3 py-1.5 text-xs font-semibold text-[#be2a3b]"
                      >
                        Xoa
                      </button>
                    </div>
                  ) : null}

                  {baiViet.danhSachBinhLuan.map((binhLuan) => (
                    <div key={binhLuan.maBinhLuan} className="rounded-md bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#2d416f]">
                          {binhLuan.tacGia?.tenNguoiDung ?? 'Nguoi dung'}
                        </span>
                        <span className="text-[11px] text-[#8a94b3]">
                          {dinhDangThoiGian(binhLuan.thoiGianTao)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d2742]">{binhLuan.noiDung}</p>
                      {binhLuan.maNguoiDung === currentUserId ? (
                        <button
                          type="button"
                          onClick={() => void onXoaBinhLuan(baiViet.maBaiViet, binhLuan.maBinhLuan)}
                          className="mt-1 text-[11px] font-semibold text-[#be2a3b]"
                        >
                          Xoa binh luan
                        </button>
                      ) : null}
                    </div>
                  ))}

                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={binhLuanNhap[baiViet.maBaiViet] ?? ''}
                      onChange={(event) =>
                        setBinhLuanNhap((prev) => ({
                          ...prev,
                          [baiViet.maBaiViet]: event.target.value,
                        }))
                      }
                      placeholder="Them binh luan..."
                      className="h-9 w-full rounded-md border border-[#d7dff5] bg-white px-3 text-sm outline-none focus:border-[#4f7cff]"
                    />
                    <button
                      type="button"
                      onClick={() => void onThemBinhLuan(baiViet.maBaiViet)}
                      className="flex h-9 items-center gap-1 rounded-md bg-[#1d59df] px-3 text-xs font-semibold text-white"
                    >
                      Gui
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {conTroTiepTheo ? (
              <button
                type="button"
                disabled={dangTaiThem}
                onClick={() => void onTaiThem()}
                className="mx-auto h-10 rounded-lg border border-[#cbd6f7] bg-white px-5 text-sm font-semibold text-[#3158b9] disabled:opacity-60"
              >
                {dangTaiThem ? 'Dang tai...' : 'Tai them'}
              </button>
            ) : null}
          </div>
        </main>

        <aside className="hidden w-[320px] shrink-0 border-l border-[#dce0eb] bg-[#f8f9fb] p-5 lg:flex lg:flex-col lg:gap-5 lg:overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d6578]">Goi y ket ban</h3>
              <button type="button" className="text-xs font-bold text-[#0052cc] hover:underline">
                Xem tat ca
              </button>
            </div>

            <div className="space-y-3">
              {goiYKetBan.map((item) => (
                <div key={item.ten} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dae2ff] text-sm font-bold text-[#0052cc]">
                      {item.ten.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#191c1e]">{item.ten}</p>
                      <p className="text-[10px] text-[#727687]">{item.moTa}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-[#0052cc] transition-colors hover:bg-[#dae2ff]"
                  >
                    Them
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-[#edf0f5] p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d6578]">Xu huong</h3>
            {xuHuong.map((item) => (
              <div key={item.tag}>
                <p className="text-[10px] font-bold text-[#727687]">{item.tag}</p>
                <p className="mt-0.5 text-xs font-bold text-[#191c1e]">{item.tieuDe}</p>
                <p className="text-[10px] text-[#727687]">{item.soBaiViet}</p>
              </div>
            ))}
          </div>

          <div className="pt-1 text-[10px] text-[#727687]">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <a href="#" className="hover:underline">Quyen rieng tu</a>
              <a href="#" className="hover:underline">Dieu khoan</a>
              <a href="#" className="hover:underline">Quang cao</a>
              <a href="#" className="hover:underline">Ho tro</a>
            </div>
            <p className="mt-3 text-[#8b91a4]">© 2026 Atrium Digital System</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
