"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ChatAppRail from '@/components/chat/ChatAppRail';
import {
  BaiVietBanTin,
  BinhLuanBanTin,
  boThichBaiViet,
  capNhatBaiViet,
  chiaSeBaiViet,
  CheDoRiengTu,
  layDanhSachBanTin,
  layDanhSachBinhLuan,
  taoBaiViet,
  themBinhLuan,
  thichBaiViet,
  xoaBaiViet,
  xoaBinhLuan,
} from '@/lib/news-feed';
import { getStoredUser, getValidAccessToken } from '@/lib/auth-client';
import { getPresignedUrl, uploadFileToS3 } from '@/lib/chat-upload';
import NewsFeedLocationPicker from '@/components/chat/NewsFeedLocationPicker';
import { createFeedSocket } from '@/lib/realtime/socket-client';
import { toast } from 'sonner';
import { FEED_EVENTS } from '@/lib/realtime/events';
import {
  Bell,
  ImageIcon,
  MapPin,
  MessageCircle,
  TextAlignJustify,
  MoreHorizontal,
  Search,
  Share2,
  Smile,
  ThumbsUp,
  UserPlus,
} from 'lucide-react';

const DANH_SACH_CAM_XUC = [
  { ma: 'happy', nhan: 'Vui vẻ' },
  { ma: 'excited', nhan: 'Hào hứng' },
  { ma: 'loved', nhan: 'Được yêu thương' },
  { ma: 'grateful', nhan: 'Biết ơn' },
  { ma: 'calm', nhan: 'Bình yên' },
  { ma: 'tired', nhan: 'Mệt mỏi' },
  { ma: 'sad', nhan: 'Buồn' },
];

function taoNoiDungKemCamXuc(noiDung: string, camXuc?: string): string {
  const noiDungTrim = noiDung.trim();
  if (!camXuc) return noiDungTrim;
  if (!noiDungTrim) return `Đang cảm thấy ${camXuc}`;
  return `Đang cảm thấy ${camXuc}: ${noiDungTrim}`;
}

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
        className="max-h-[70vh] w-full object-contain bg-black"
      >
        {hienThiNguon ? <source src={src} /> : null}
      </video>
      <div className="flex items-center justify-between bg-[#0e1320] px-3 py-1 text-xs text-white">
        <span>Video</span>
        <span>{dangTuDongPhat ? 'Đang phát' : 'Tạm dừng'}</span>
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
  const [tienTrinhUpload, setTienTrinhUpload] = useState<number | null>(null);

  const [noiDung, setNoiDung] = useState('');
  const [viTri, setViTri] = useState('');
  const [cheDoRiengTu, setCheDoRiengTu] = useState<CheDoRiengTu>('friends');
  const [anhDaChon, setAnhDaChon] = useState<File[]>([]);
  const [videoDaChon, setVideoDaChon] = useState<File[]>([]);
  const [maCamXucDaChon, setMaCamXucDaChon] = useState<string | null>(null);
  const [moBangCamXuc, setMoBangCamXuc] = useState(false);
  const [binhLuanNhap, setBinhLuanNhap] = useState<Record<string, string>>({});
  const [maBaiVietMoTuyChon, setMaBaiVietMoTuyChon] = useState<string | null>(null);
  const [baiVietDangSua, setBaiVietDangSua] = useState<BaiVietBanTin | null>(null);
  const [noiDungSua, setNoiDungSua] = useState('');
  const [dangLuuSuaBaiViet, setDangLuuSuaBaiViet] = useState(false);
  const [baiVietDangChiaSe, setBaiVietDangChiaSe] = useState<BaiVietBanTin | null>(null);
  const [ghiChuChiaSe, setGhiChuChiaSe] = useState('');
  const [dangChiaSeBaiViet, setDangChiaSeBaiViet] = useState(false);
  const [baiVietChoXoa, setBaiVietChoXoa] = useState<BaiVietBanTin | null>(null);
  const [dangXoaBaiViet, setDangXoaBaiViet] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const timeoutsThich = useRef<Record<string, NodeJS.Timeout>>({});
  const [dangPhanHoi, setDangPhanHoi] = useState<Record<string, BinhLuanBanTin | null>>({});
  const [baiVietChoHienThi, setBaiVietChoHienThi] = useState<BaiVietBanTin[]>([]);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  const nhanCamXucDaChon = useMemo(
    () => DANH_SACH_CAM_XUC.find((item) => item.ma === maCamXucDaChon)?.nhan,
    [maCamXucDaChon],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-post-options]')) {
        setMaBaiVietMoTuyChon(null);
      }
      if (!target?.closest('[data-emotion-picker]')) {
        setMoBangCamXuc(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

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
        setLoi(error instanceof Error ? error.message : 'Không tải được bản tin');
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
        if (payload.maNguoiDung === currentUserId) {
          setDanhSachBaiViet((prev) => [
            payload,
            ...prev.filter((item) => item.maBaiViet !== payload.maBaiViet),
          ]);
        } else {
          setBaiVietChoHienThi((prev) => {
            const existed = prev.some((item) => item.maBaiViet === payload.maBaiViet);
            return existed ? prev : [payload, ...prev];
          });
        }
      };

      const onPostUpdated = (payload: BaiVietBanTin) => {
        setDanhSachBaiViet((prev) =>
          prev.map((item) => (item.maBaiViet === payload.maBaiViet ? payload : item)),
        );
        setBaiVietChoHienThi((prev) =>
          prev.map((item) => (item.maBaiViet === payload.maBaiViet ? payload : item)),
        );
      };

      const onPostDeleted = (payload: { maBaiViet: string }) => {
        setDanhSachBaiViet((prev) =>
          prev.filter((item) => item.maBaiViet !== payload.maBaiViet),
        );
        setBaiVietChoHienThi((prev) =>
          prev.filter((item) => item.maBaiViet !== payload.maBaiViet),
        );
      };

      const onReactionUpdated = (payload: {
        maBaiViet: string;
        daThich: boolean;
        soLuotThich: number;
        maNguoiDungTacGia?: string;
        nguoiTuongTac?: {
          maNguoiDung: string;
          tenNguoiDung: string;
        };
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

        if (
          payload.maNguoiDungTacGia === currentUserId &&
          payload.nguoiTuongTac &&
          payload.nguoiTuongTac.maNguoiDung !== currentUserId &&
          payload.daThich
        ) {
          toast.success(`${payload.nguoiTuongTac.tenNguoiDung} đã thích bài viết của bạn!`);
        }
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

  const uploadDanhSachFile = async (
    files: File[],
    startIndex: number,
    totalFiles: number,
    loadedBytesMap: { current: Record<string, number> },
    totalBytes: number,
  ) => {
    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileKey = `${file.name}-${file.size}-${startIndex + i}`;
      const presigned = await getPresignedUrl(file.name, file.type, file.size);
      await uploadFileToS3(presigned.uploadUrl, file, (percent) => {
        const loaded = Math.round((percent / 100) * file.size);
        loadedBytesMap.current[fileKey] = loaded;
        const totalLoaded = Object.values(loadedBytesMap.current).reduce((a, b) => a + b, 0);
        const overallPercent = Math.min(99, Math.round((totalLoaded / totalBytes) * 100));
        setTienTrinhUpload(overallPercent);
      });
      loadedBytesMap.current[fileKey] = file.size;
      urls.push(presigned.publicUrl);
    }

    return urls;
  };

  const onDangBai = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const noiDungDangBai = taoNoiDungKemCamXuc(noiDung, nhanCamXucDaChon);
    const viTriDangBai = viTri.trim();

    if (!noiDungDangBai && !viTriDangBai && anhDaChon.length === 0 && videoDaChon.length === 0) {
      setLoi('Vui lòng nhập nội dung, vị trí hoặc chọn ảnh/video để đăng bài');
      return;
    }

    const noiDungCu = noiDung;
    const viTriCu = viTri;
    const anhDaChonCu = [...anhDaChon];
    const videoDaChonCu = [...videoDaChon];
    const cheDoRiengTuCu = cheDoRiengTu;
    const maCamXucDaChonCu = maCamXucDaChon;

    setDangDangBai(true);
    setLoi('');

    let maTam: string | null = null;
    let daThemBaiTam = false;

    try {
      const allFiles = [...anhDaChon, ...videoDaChon];
      const totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0);
      const loadedBytesMap = { current: {} as Record<string, number> };

      if (totalBytes > 0) {
        setTienTrinhUpload(0);
      }

      const [danhSachAnh, danhSachVideo] = await Promise.all([
        uploadDanhSachFile(anhDaChon, 0, allFiles.length, loadedBytesMap, totalBytes),
        uploadDanhSachFile(videoDaChon, anhDaChon.length, allFiles.length, loadedBytesMap, totalBytes),
      ]);

      if (totalBytes > 0) {
        setTienTrinhUpload(100);
      }

      const thoiDiem = new Date().toISOString();
      maTam = `temp-post-${crypto.randomUUID()}`;

      const baiVietTam: BaiVietBanTin = {
        maBaiViet: maTam,
        maNguoiDung: currentUserId,
        noiDung: noiDungDangBai,
        viTri: viTriDangBai,
        danhSachAnh,
        danhSachVideo,
        cheDoRiengTu,
        daXoa: false,
        soLuotThich: 0,
        soBinhLuan: 0,
        soLuotChiaSe: 0,
        thoiGianTao: thoiDiem,
        thoiGianCapNhat: thoiDiem,
        tacGia: currentUser
          ? {
              maNguoiDung: currentUserId,
              tenNguoiDung: currentUser.name,
              anhDaiDien: currentUser.avatarUrl,
            }
          : null,
        daThich: false,
        danhSachBinhLuan: [],
      };

      setDanhSachBaiViet((prev) => [baiVietTam, ...prev]);
      daThemBaiTam = true;
      setNoiDung('');
      setViTri('');
      setAnhDaChon([]);
      setVideoDaChon([]);
      setCheDoRiengTu('friends');
      setMaCamXucDaChon(null);
      setMoBangCamXuc(false);

      const baiMoi = await taoBaiViet({
        noiDung: noiDungDangBai,
        viTri: viTriDangBai,
        danhSachAnh,
        danhSachVideo,
        cheDoRiengTu,
      });

      setDanhSachBaiViet((prev) => {
        const danhSachThayTam = prev.map((item) =>
          item.maBaiViet === maTam ? baiMoi : item,
        );
        return danhSachThayTam.filter(
          (item, index, arr) => arr.findIndex((p) => p.maBaiViet === item.maBaiViet) === index,
        );
      });
    } catch (error) {
      if (daThemBaiTam && maTam) {
        setDanhSachBaiViet((prev) => prev.filter((item) => item.maBaiViet !== maTam));
        setNoiDung(noiDungCu);
        setViTri(viTriCu);
        setAnhDaChon(anhDaChonCu);
        setVideoDaChon(videoDaChonCu);
        setCheDoRiengTu(cheDoRiengTuCu);
        setMaCamXucDaChon(maCamXucDaChonCu);
      }
      setLoi(error instanceof Error ? error.message : 'Đăng bài thất bại');
    } finally {
      setDangDangBai(false);
      setTienTrinhUpload(null);
    }
  };

  const onThich = (post: BaiVietBanTin) => {
    const trangThaiMoiDaThich = !post.daThich;
    const trangThaiCu = {
      daThich: post.daThich,
      soLuotThich: post.soLuotThich,
    };

    setDanhSachBaiViet((prev) =>
      prev.map((item) =>
        item.maBaiViet === post.maBaiViet
          ? {
              ...item,
              daThich: trangThaiMoiDaThich,
              soLuotThich: Math.max(0, item.soLuotThich + (post.daThich ? -1 : 1)),
            }
          : item,
      ),
    );

    if (timeoutsThich.current[post.maBaiViet]) {
      clearTimeout(timeoutsThich.current[post.maBaiViet]);
    }

    timeoutsThich.current[post.maBaiViet] = setTimeout(async () => {
      try {
        const result = trangThaiMoiDaThich
          ? await thichBaiViet(post.maBaiViet)
          : await boThichBaiViet(post.maBaiViet);

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
        setDanhSachBaiViet((prev) =>
          prev.map((item) =>
            item.maBaiViet === post.maBaiViet
              ? {
                  ...item,
                  daThich: trangThaiCu.daThich,
                  soLuotThich: trangThaiCu.soLuotThich,
                }
              : item,
          ),
        );
        setLoi(error instanceof Error ? error.message : 'Không cập nhật được lượt thích');
      } finally {
        delete timeoutsThich.current[post.maBaiViet];
      }
    }, 300);
  };

  const onThemBinhLuan = async (maBaiViet: string) => {
    const noiDungBinhLuan = (binhLuanNhap[maBaiViet] ?? '').trim();
    if (!noiDungBinhLuan) return;

    const parentComment = dangPhanHoi[maBaiViet];
    const parentId = parentComment?.maBinhLuan || null;

    const noiDungNhapCu = binhLuanNhap[maBaiViet] ?? '';
    const thoiDiem = new Date().toISOString();
    const maTam = `temp-comment-${crypto.randomUUID()}`;
    const binhLuanTam: BaiVietBanTin['danhSachBinhLuan'][number] = {
      maBinhLuan: maTam,
      maBaiViet,
      maNguoiDung: currentUserId,
      noiDung: noiDungBinhLuan,
      maBinhLuanCha: parentId,
      thoiGianTao: thoiDiem,
      thoiGianCapNhat: thoiDiem,
      tacGia: currentUser
        ? {
            maNguoiDung: currentUserId,
            tenNguoiDung: currentUser.name,
            anhDaiDien: currentUser.avatarUrl,
          }
        : null,
    };

    setBinhLuanNhap((prev) => ({ ...prev, [maBaiViet]: '' }));
    setDangPhanHoi((prev) => ({ ...prev, [maBaiViet]: null }));

    setDanhSachBaiViet((prev) =>
      prev.map((item) =>
        item.maBaiViet === maBaiViet
          ? {
              ...item,
              soBinhLuan: item.soBinhLuan + 1,
              danhSachBinhLuan: [...item.danhSachBinhLuan, binhLuanTam],
            }
          : item,
      ),
    );

    try {
      const binhLuanMoi = await themBinhLuan(maBaiViet, noiDungBinhLuan, parentId || undefined);
      setDanhSachBaiViet((prev) =>
        prev.map((item) => {
          if (item.maBaiViet !== maBaiViet) return item;

          const daCoBinhLuanMoi = item.danhSachBinhLuan.some(
            (binhLuan) => binhLuan.maBinhLuan === binhLuanMoi.maBinhLuan,
          );

          const danhSachKhongTam = item.danhSachBinhLuan.filter(
            (binhLuan) => binhLuan.maBinhLuan !== maTam,
          );

          return {
            ...item,
            danhSachBinhLuan: daCoBinhLuanMoi
              ? danhSachKhongTam
              : [...danhSachKhongTam, binhLuanMoi],
          };
        }),
      );
    } catch (error) {
      setBinhLuanNhap((prev) => ({ ...prev, [maBaiViet]: noiDungNhapCu }));
      if (parentComment) {
        setDangPhanHoi((prev) => ({ ...prev, [maBaiViet]: parentComment }));
      }
      setDanhSachBaiViet((prev) =>
        prev.map((item) => {
          if (item.maBaiViet !== maBaiViet) return item;
          return {
            ...item,
            soBinhLuan: Math.max(0, item.soBinhLuan - 1),
            danhSachBinhLuan: item.danhSachBinhLuan.filter(
              (binhLuan) => binhLuan.maBinhLuan !== maTam,
            ),
          };
        }),
      );
      setLoi(error instanceof Error ? error.message : 'Thêm bình luận thất bại');
    }
  };

  const onTaiBinhLuan = async (maBaiViet: string) => {
    try {
      const response = await layDanhSachBinhLuan(maBaiViet);
      setDanhSachBaiViet((prev) =>
        prev.map((item) =>
          item.maBaiViet === maBaiViet
            ? {
                ...item,
                danhSachBinhLuan: response.items,
              }
            : item,
        ),
      );
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Tải danh sách bình luận thất bại');
    }
  };

  const onXoaBinhLuan = async (maBaiViet: string, maBinhLuan: string) => {
    const baiVietHienTai = danhSachBaiViet.find((item) => item.maBaiViet === maBaiViet);
    const viTriBinhLuan = baiVietHienTai?.danhSachBinhLuan.findIndex(
      (binhLuan) => binhLuan.maBinhLuan === maBinhLuan,
    ) ?? -1;
    const binhLuanCu =
      viTriBinhLuan >= 0 ? baiVietHienTai?.danhSachBinhLuan[viTriBinhLuan] : undefined;

    if (!binhLuanCu) return;

    setDanhSachBaiViet((prev) =>
      prev.map((item) =>
        item.maBaiViet === maBaiViet
          ? {
              ...item,
              soBinhLuan: Math.max(0, item.soBinhLuan - 1),
              danhSachBinhLuan: item.danhSachBinhLuan.filter(
                (binhLuan) => binhLuan.maBinhLuan !== maBinhLuan,
              ),
            }
          : item,
      ),
    );

    try {
      await xoaBinhLuan(maBaiViet, maBinhLuan);
    } catch (error) {
      setDanhSachBaiViet((prev) =>
        prev.map((item) => {
          if (item.maBaiViet !== maBaiViet) return item;
          const daTonTai = item.danhSachBinhLuan.some(
            (binhLuan) => binhLuan.maBinhLuan === maBinhLuan,
          );
          if (daTonTai) return item;

          const danhSachMoi = [...item.danhSachBinhLuan];
          const viTriChen = Math.min(Math.max(0, viTriBinhLuan), danhSachMoi.length);
          danhSachMoi.splice(viTriChen, 0, binhLuanCu);

          return {
            ...item,
            soBinhLuan: item.soBinhLuan + 1,
            danhSachBinhLuan: danhSachMoi,
          };
        }),
      );
      setLoi(error instanceof Error ? error.message : 'Xóa bình luận thất bại');
    }
  };

  const moModalSuaBaiViet = (post: BaiVietBanTin) => {
    setBaiVietDangSua(post);
    setNoiDungSua(post.noiDung);
  };

  const onSuaBaiViet = async () => {
    if (!baiVietDangSua) return;

    const noiDungMoi = noiDungSua;
    const noiDungCu = baiVietDangSua.noiDung;

    setDangLuuSuaBaiViet(true);
    setDanhSachBaiViet((prev) =>
      prev.map((item) =>
        item.maBaiViet === baiVietDangSua.maBaiViet
          ? {
              ...item,
              noiDung: noiDungMoi,
            }
          : item,
      ),
    );

    try {
      const updated = await capNhatBaiViet(baiVietDangSua.maBaiViet, { noiDung: noiDungMoi });
      setDanhSachBaiViet((prev) =>
        prev.map((item) => (item.maBaiViet === updated.maBaiViet ? updated : item)),
      );
      setBaiVietDangSua(null);
      setNoiDungSua('');
    } catch (error) {
      setDanhSachBaiViet((prev) =>
        prev.map((item) =>
          item.maBaiViet === baiVietDangSua.maBaiViet
            ? {
                ...item,
                noiDung: noiDungCu,
              }
            : item,
        ),
      );
      setLoi(error instanceof Error ? error.message : 'Cập nhật bài viết thất bại');
    } finally {
      setDangLuuSuaBaiViet(false);
    }
  };

  const moXacNhanXoaBaiViet = (post: BaiVietBanTin) => {
    setBaiVietChoXoa(post);
  };

  const onXoaBaiViet = async () => {
    if (!baiVietChoXoa) return;

    const maBaiViet = baiVietChoXoa.maBaiViet;
    const viTriBaiViet = danhSachBaiViet.findIndex((item) => item.maBaiViet === maBaiViet);
    const baiVietCu = viTriBaiViet >= 0 ? danhSachBaiViet[viTriBaiViet] : undefined;

    if (!baiVietCu) {
      setBaiVietChoXoa(null);
      return;
    }

    setDangXoaBaiViet(true);
    setDanhSachBaiViet((prev) => prev.filter((item) => item.maBaiViet !== maBaiViet));

    try {
      await xoaBaiViet(maBaiViet);
      setBaiVietChoXoa(null);
    } catch (error) {
      setDanhSachBaiViet((prev) => {
        const daTonTai = prev.some((item) => item.maBaiViet === maBaiViet);
        if (daTonTai) return prev;
        const danhSachMoi = [...prev];
        const viTriChen = Math.min(Math.max(0, viTriBaiViet), danhSachMoi.length);
        danhSachMoi.splice(viTriChen, 0, baiVietCu);
        return danhSachMoi;
      });
      setLoi(error instanceof Error ? error.message : 'Xóa bài viết thất bại');
    } finally {
      setDangXoaBaiViet(false);
    }
  };

  const moModalChiaSe = (post: BaiVietBanTin) => {
    setBaiVietDangChiaSe(post);
    setGhiChuChiaSe('');
  };

  const onChiaSe = async () => {
    if (!baiVietDangChiaSe) return;

    const post = baiVietDangChiaSe;
    const ghiChu = ghiChuChiaSe;
    setDangChiaSeBaiViet(true);

    const thoiDiem = new Date().toISOString();
    const maTam = `temp-share-${crypto.randomUUID()}`;
    const baiChiaSeTam: BaiVietBanTin = {
      maBaiViet: maTam,
      maNguoiDung: currentUserId,
      noiDung: ghiChu,
        viTri: undefined,
      danhSachAnh: [],
      danhSachVideo: [],
      cheDoRiengTu,
      maBaiVietGoc: post.maBaiViet,
      daXoa: false,
      soLuotThich: 0,
      soBinhLuan: 0,
      soLuotChiaSe: 0,
      thoiGianTao: thoiDiem,
      thoiGianCapNhat: thoiDiem,
      tacGia: currentUser
        ? {
            maNguoiDung: currentUserId,
            tenNguoiDung: currentUser.name,
            anhDaiDien: currentUser.avatarUrl,
          }
        : null,
      daThich: false,
      danhSachBinhLuan: [],
    };

    setDanhSachBaiViet((prev) => [baiChiaSeTam, ...prev]);
    setDanhSachBaiViet((prev) =>
      prev.map((item) =>
        item.maBaiViet === post.maBaiViet
          ? {
              ...item,
              soLuotChiaSe: item.soLuotChiaSe + 1,
            }
          : item,
      ),
    );

    try {
      const result = await chiaSeBaiViet(post.maBaiViet, { noiDung: ghiChu });
      setDanhSachBaiViet((prev) => {
        const danhSachThayTam = prev.map((item) =>
          item.maBaiViet === maTam ? result : item,
        );
        return danhSachThayTam.filter(
          (item, index, arr) => arr.findIndex((p) => p.maBaiViet === item.maBaiViet) === index,
        );
      });
      setBaiVietDangChiaSe(null);
      setGhiChuChiaSe('');
    } catch (error) {
      setDanhSachBaiViet((prev) =>
        prev
          .filter((item) => item.maBaiViet !== maTam)
          .map((item) =>
            item.maBaiViet === post.maBaiViet
              ? {
                  ...item,
                  soLuotChiaSe: Math.max(0, item.soLuotChiaSe - 1),
                }
              : item,
          ),
      );
      setLoi(error instanceof Error ? error.message : 'Chia sẻ bài viết thất bại');
    } finally {
      setDangChiaSeBaiViet(false);
    }
  };

  const onTaiThem = async () => {
    if (!conTroTiepTheo) return;
    setDangTaiThem(true);
    try {
      await loadBanTin(conTroTiepTheo);
    } catch (error) {
      setLoi(error instanceof Error ? error.message : 'Không tải thêm dữ liệu');
    } finally {
      setDangTaiThem(false);
    }
  };

  const goiYKetBan = [
    { ten: 'Tuấn Hải', moTa: 'Gợi ý cho bạn' },
    { ten: 'Ngọc Mai', moTa: 'Bạn chung: 5' },
    { ten: 'Bảo Châu', moTa: 'Bạn chung: 2' },
  ];

  const xuHuong = [
    { tag: '#DesignSystem', tieuDe: 'Xu hướng thiết kế 2026', soBaiViet: '1.2K bài viết' },
    { tag: '#AtriumConnect', tieuDe: 'Sự kiện ra mắt ứng dụng', soBaiViet: '850 bài viết' },
    { tag: '#TechNews', tieuDe: 'AI và tương lai của Chat', soBaiViet: '2.4K bài viết' },
  ];

  if (!currentUser) {
    return (
      <section className="mx-auto flex h-full w-full max-w-3xl items-center justify-center px-4 py-8">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.
        </p>
      </section>
    );
  }

  return (
    <section className="relative flex h-full w-full flex-col overflow-hidden bg-[#f8f9fb] text-[#191c1e]">

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#c2c6d8]/40 bg-[#f8f9fb] px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-6">
          <button
            type="button"
            onClick={() => setIsMobileRailOpen(true)}
            className="rounded-full p-2 text-zinc-700 hover:bg-slate-100 md:hidden"
            aria-label="Mở thanh điều hướng"
          >
            <TextAlignJustify className="h-5 w-5" />
          </button>
          <h1 className="bg-linear-to-r from-[#003e9e] via-[#005fd1] to-[#008cff] bg-clip-text text-xl font-black tracking-tight text-transparent">
            Bản tin
          </h1>
          <div className="hidden items-center rounded-full bg-white/95 px-4 py-2 shadow-sm ring-1 ring-[#d8e1f2] md:flex md:w-80">
            <Search size={16} className="mr-2 text-[#7b8398]" />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              className="w-full border-none bg-transparent p-0 text-sm text-[#273045] outline-none placeholder:text-[#8b91a4]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[#d8e1f2] bg-white p-2 text-[#5c647a] shadow-sm transition-colors hover:bg-[#eef2fb]"
          >
            <UserPlus size={18} />
          </button>
          <button
            type="button"
            className="relative rounded-full border border-[#d8e1f2] bg-white p-2 text-[#5c647a] shadow-sm transition-colors hover:bg-[#eef2fb]"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ba1a1a]" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {baiVietChoHienThi.length > 0 ? (
          <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
            <button
              type="button"
              onClick={() => {
                setDanhSachBaiViet((prev) => {
                  const combined = [...baiVietChoHienThi, ...prev];
                  return combined.filter(
                    (item, idx, self) => self.findIndex((p) => p.maBaiViet === item.maBaiViet) === idx,
                  );
                });
                setBaiVietChoHienThi([]);
                feedContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 rounded-full bg-[#1d59df] px-5 py-2.5 text-xs font-bold text-white shadow-[0_12px_30px_rgba(29,89,223,0.4)] transition-all hover:scale-105 hover:bg-[#184ec6] active:scale-95 animate-bounce"
            >
              Có bài viết mới ({baiVietChoHienThi.length}) ↑
            </button>
          </div>
        ) : null}

        <main ref={feedContainerRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:pb-6 lg:px-10">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <div className="rounded-2xl border border-[#dbe5f7] bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5d6a88]">Bảng tin hôm nay</p>
              <p className="mt-1 text-sm text-[#3a435a]">{danhSachBaiViet.length} bài viết mới trong cộng đồng của bạn.</p>
            </div>

            <form onSubmit={onDangBai} className="rounded-2xl border border-[#dbe5f7] bg-white p-4 shadow-[0_12px_30px_rgba(26,71,156,0.08)] md:p-5">
              <div className="flex gap-3">
                <Avatar tenNguoiDung={currentUser.name} anhDaiDien={currentUser.avatarUrl} />
                <div className="w-full">
                  <textarea
                    value={noiDung}
                    onChange={(event) => setNoiDung(event.target.value)}
                    rows={3}
                    placeholder="Bạn đang nghĩ gì?"
                    className="w-full resize-none rounded-2xl border border-[#d6e0f3] bg-[#f8faff] px-4 py-2.5 text-sm text-[#25304a] outline-none placeholder:text-[#8b91a4] transition-colors focus:border-[#4f7cff]"
                  />
                  {nhanCamXucDaChon ? (
                    <p className="mt-2 text-xs font-semibold text-[#3158b9]">
                      Bạn đang cảm thấy {nhanCamXucDaChon}
                    </p>
                  ) : null}
                </div>
              </div>

              {tienTrinhUpload !== null ? (
                <div className="mt-4 border-t border-[#e8ecf5] pt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#1d59df]">
                    <span>Đang tải lên media...</span>
                    <span>{tienTrinhUpload}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e8f0ff]">
                    <div
                      className="h-full bg-linear-to-r from-[#005eff] to-[#00aaff] transition-all duration-150 ease-out"
                      style={{ width: `${tienTrinhUpload}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e8ecf5] pt-3.5">
                <div className="flex flex-wrap items-center gap-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]">
                    <ImageIcon size={16} className="text-[#0068ff]" />
                    Ảnh/Video ({anhDaChon.length + videoDaChon.length})
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

                  <div className="relative" data-emotion-picker>
                    <button
                      type="button"
                      onClick={() => setMoBangCamXuc((prev) => !prev)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
                    >
                      <Smile size={16} className="text-[#a33500]" />
                      {nhanCamXucDaChon ? `Cảm xúc: ${nhanCamXucDaChon}` : 'Cảm xúc'}
                    </button>

                    {moBangCamXuc ? (
                      <div className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-[#dce4f3] bg-white p-1 shadow-[0_10px_24px_rgba(34,66,124,0.14)]">
                        {DANH_SACH_CAM_XUC.map((camXuc) => (
                          <button
                            key={camXuc.ma}
                            type="button"
                            onClick={() => {
                              setMaCamXucDaChon(camXuc.ma);
                              setMoBangCamXuc(false);
                            }}
                            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              maCamXucDaChon === camXuc.ma
                                ? 'bg-[#e8f0ff] text-[#1d59df]'
                                : 'text-[#2f3a56] hover:bg-[#eef2fa]'
                            }`}
                          >
                            {camXuc.nhan}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setMaCamXucDaChon(null);
                            setMoBangCamXuc(false);
                          }}
                          className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#be2a3b] transition-colors hover:bg-[#fff1f3]"
                        >
                          Xóa cảm xúc
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <NewsFeedLocationPicker value={viTri} onChange={setViTri} />

                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={cheDoRiengTu}
                    onChange={(event) => setCheDoRiengTu(event.target.value as CheDoRiengTu)}
                    className="h-10 rounded-full border border-[#d7dcec] bg-white px-3 text-xs font-semibold text-[#4f5870] shadow-sm"
                  >
                    <option value="public">Công khai</option>
                    <option value="friends">Bạn bè</option>
                    <option value="private">Riêng tư</option>
                  </select>

                  <button
                    type="submit"
                    disabled={dangDangBai}
                    className="rounded-full bg-linear-to-r from-[#0047b4] to-[#0074ff] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(0,94,255,0.3)] transition-transform hover:brightness-105 active:scale-95 disabled:opacity-60"
                  >
                    {dangDangBai ? 'Đang tải...' : 'Đăng'}
                  </button>
                </div>
              </div>
            </form>

            {loi ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
                {loi}
              </p>
            ) : null}

            {dangTaiBanTin ? (
              <div className="rounded-2xl border border-[#dce4f3] bg-white p-5 text-sm text-[#6c7899] shadow-sm">
                Đang tải bản tin...
              </div>
            ) : null}

            {!dangTaiBanTin && danhSachBaiViet.length === 0 ? (
              <div className="rounded-2xl border border-[#dce4f3] bg-white p-5 text-sm text-[#6c7899] shadow-sm">
                Chưa có bài viết nào.
              </div>
            ) : null}

            {danhSachBaiViet.map((baiViet) => (
              <article
                key={baiViet.maBaiViet}
                className="overflow-hidden rounded-2xl border border-[#dce4f3] bg-white shadow-[0_10px_24px_rgba(34,66,124,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(34,66,124,0.14)]"
              >
                <div className="flex items-center justify-between p-4 pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      tenNguoiDung={baiViet.tacGia?.tenNguoiDung ?? 'Người dùng'}
                      anhDaiDien={baiViet.tacGia?.anhDaiDien}
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#191c1e]">
                        {baiViet.tacGia?.tenNguoiDung ?? 'Người dùng'}
                      </h2>
                      <p className="text-xs text-[#727687]">{dinhDangThoiGian(baiViet.thoiGianTao)}</p>
                    </div>
                  </div>

                  <div className="relative" data-post-options>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={maBaiVietMoTuyChon === baiViet.maBaiViet}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMaBaiVietMoTuyChon((prev) =>
                          prev === baiViet.maBaiViet ? null : baiViet.maBaiViet,
                        );
                      }}
                      className="rounded-full p-2 text-[#6b7387] transition-colors hover:bg-[#eef2fa]"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {maBaiVietMoTuyChon === baiViet.maBaiViet ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-[#dce4f3] bg-white p-1 shadow-[0_10px_24px_rgba(34,66,124,0.14)]"
                      >
                        {baiViet.maNguoiDung === currentUserId ? (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMaBaiVietMoTuyChon(null);
                                moModalSuaBaiViet(baiViet);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#2f3a56] transition-colors hover:bg-[#eef2fa]"
                            >
                              Sửa bài viết
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMaBaiVietMoTuyChon(null);
                                moXacNhanXoaBaiViet(baiViet);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#be2a3b] transition-colors hover:bg-[#fff1f3]"
                            >
                              Xóa bài viết
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setMaBaiVietMoTuyChon(null)}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[#2f3a56] transition-colors hover:bg-[#eef2fa]"
                          >
                            Đóng
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {baiViet.noiDung ? (
                  <p className="px-4 pb-3 whitespace-pre-wrap text-sm leading-relaxed text-[#1b2336]">
                    {baiViet.noiDung}
                  </p>
                ) : null}

                {baiViet.viTri ? (
                  <div className="px-4 pb-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#3158b9]">
                      <MapPin size={14} />
                      <span>{baiViet.viTri}</span>
                    </div>
                  </div>
                ) : null}

                {baiViet.danhSachAnh.length > 0 ? (
                  <div className={`grid gap-1 ${baiViet.danhSachAnh.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {baiViet.danhSachAnh.map((anh) => (
                      <img
                        key={anh}
                        src={anh}
                        alt="Ảnh bài viết"
                        loading="lazy"
                        className="h-64 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
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

                <div className="flex items-center justify-between border-t border-[#edf1f8] bg-[#fcfdff] px-4 py-2 text-xs text-[#68718a]">
                  <span>{baiViet.soLuotThich} lượt thích</span>
                  <span>
                    {baiViet.soBinhLuan} bình luận • {baiViet.soLuotChiaSe} chia sẻ
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 border-t border-[#edf1f8] bg-white p-1.5">
                  <button
                    type="button"
                    onClick={() => void onThich(baiViet)}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors ${
                      baiViet.daThich
                        ? 'bg-[#e7efff] text-[#0052cc]'
                        : 'text-[#4f5870] hover:bg-[#eef2fa]'
                    }`}
                  >
                    <ThumbsUp size={16} />
                    {baiViet.daThich ? 'Bỏ thích' : 'Thích'}
                  </button>

                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
                  >
                    <MessageCircle size={16} />
                    Bình luận
                  </button>

                  <button
                    type="button"
                    onClick={() => moModalChiaSe(baiViet)}
                    className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
                  >
                    <Share2 size={16} />
                    Chia sẻ
                  </button>
                </div>

                <div className="space-y-3 bg-[#f8fbff] p-3 rounded-b-2xl">
                  {baiViet.soBinhLuan > 10 &&
                  baiViet.danhSachBinhLuan.length < baiViet.soBinhLuan ? (
                    <button
                      type="button"
                      onClick={() => void onTaiBinhLuan(baiViet.maBaiViet)}
                      className="text-xs font-semibold text-[#1d59df] hover:underline pb-1 block"
                    >
                      Xem thêm {baiViet.soBinhLuan - baiViet.danhSachBinhLuan.length} bình luận
                    </button>
                  ) : null}
                  {baiViet.danhSachBinhLuan
                    .filter((binhLuan) => !binhLuan.maBinhLuanCha)
                    .map((binhLuan) => {
                      const phanHoi = baiViet.danhSachBinhLuan.filter(
                        (reply) => reply.maBinhLuanCha === binhLuan.maBinhLuan,
                      );

                      return (
                        <div key={binhLuan.maBinhLuan} className="space-y-2">
                          <div className="rounded-xl border border-[#e5ebfa] bg-white p-2.5 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#2d416f]">
                                {binhLuan.tacGia?.tenNguoiDung ?? 'Người dùng'}
                              </span>
                              <span className="text-[11px] text-[#8a94b3]">
                                {dinhDangThoiGian(binhLuan.thoiGianTao)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d2742]">{binhLuan.noiDung}</p>
                            <div className="mt-1 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setDangPhanHoi((prev) => ({
                                    ...prev,
                                    [baiViet.maBaiViet]: binhLuan,
                                  }));
                                  const inputEl = document.getElementById(`input-binh-luan-${baiViet.maBaiViet}`);
                                  if (inputEl) inputEl.focus();
                                }}
                                className="text-[11px] font-semibold text-[#1d59df] hover:underline"
                              >
                                Phản hồi
                              </button>
                              {binhLuan.maNguoiDung === currentUserId ? (
                                <button
                                  type="button"
                                  onClick={() => void onXoaBinhLuan(baiViet.maBaiViet, binhLuan.maBinhLuan)}
                                  className="text-[11px] font-semibold text-[#be2a3b] hover:underline"
                                >
                                  Xóa
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {/* Child comments (indented) */}
                          {phanHoi.length > 0 ? (
                            <div className="ml-8 pl-3.5 border-l-2 border-[#dbe5f7] space-y-2">
                              {phanHoi.map((reply) => (
                                <div key={reply.maBinhLuan} className="rounded-xl border border-[#e5ebfa] bg-white/70 p-2.5 shadow-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-[#2d416f]">
                                      {reply.tacGia?.tenNguoiDung ?? 'Người dùng'}
                                    </span>
                                    <span className="text-[11px] text-[#8a94b3]">
                                      {dinhDangThoiGian(reply.thoiGianTao)}
                                    </span>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d2742]">{reply.noiDung}</p>
                                  <div className="mt-1 flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDangPhanHoi((prev) => ({
                                          ...prev,
                                          [baiViet.maBaiViet]: binhLuan,
                                        }));
                                        const inputEl = document.getElementById(`input-binh-luan-${baiViet.maBaiViet}`);
                                        if (inputEl) inputEl.focus();
                                      }}
                                      className="text-[11px] font-semibold text-[#1d59df] hover:underline"
                                    >
                                      Phản hồi
                                    </button>
                                    {reply.maNguoiDung === currentUserId ? (
                                      <button
                                        type="button"
                                        onClick={() => void onXoaBinhLuan(baiViet.maBaiViet, reply.maBinhLuan)}
                                        className="text-[11px] font-semibold text-[#be2a3b] hover:underline"
                                      >
                                        Xóa
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                  {dangPhanHoi[baiViet.maBaiViet] ? (
                    <div className="flex items-center justify-between bg-[#eef3fe] px-3 py-1.5 rounded-lg text-xs font-medium text-[#1d59df]">
                      <span>
                        Đang phản hồi <strong>{dangPhanHoi[baiViet.maBaiViet]?.tacGia?.tenNguoiDung ?? 'Người dùng'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDangPhanHoi((prev) => ({
                            ...prev,
                            [baiViet.maBaiViet]: null,
                          }))
                        }
                        className="font-bold text-[#be2a3b] hover:underline"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id={`input-binh-luan-${baiViet.maBaiViet}`}
                      value={binhLuanNhap[baiViet.maBaiViet] ?? ''}
                      onChange={(event) =>
                        setBinhLuanNhap((prev) => ({
                          ...prev,
                          [baiViet.maBaiViet]: event.target.value,
                        }))
                      }
                      placeholder={
                        dangPhanHoi[baiViet.maBaiViet]
                          ? `Viết phản hồi cho ${dangPhanHoi[baiViet.maBaiViet]?.tacGia?.tenNguoiDung ?? 'Người dùng'}...`
                          : 'Thêm bình luận...'
                      }
                      className="h-9 w-full rounded-lg border border-[#d7dff5] bg-white px-3 text-sm text-[#263049] outline-none transition-colors focus:border-[#4f7cff]"
                    />
                    <button
                      type="button"
                      onClick={() => void onThemBinhLuan(baiViet.maBaiViet)}
                      className="flex h-9 items-center gap-1 rounded-lg bg-[#1d59df] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#184ec6]"
                    >
                      Gửi
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
                className="mx-auto h-10 rounded-xl border border-[#cbd6f7] bg-white px-6 text-sm font-semibold text-[#3158b9] shadow-sm transition-colors hover:bg-[#f2f6ff] disabled:opacity-60"
              >
                {dangTaiThem ? 'Đang tải...' : 'Tải thêm'}
              </button>
            ) : null}
          </div>
        </main>

        <aside className="hidden w-82.5 shrink-0 border-l border-[#dce4f3] bg-white/70 p-5 backdrop-blur-sm lg:flex lg:flex-col lg:gap-5 lg:overflow-y-auto">
          <div className="rounded-2xl border border-[#dde6f8] bg-white p-4 shadow-sm">
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d6578]">Gợi ý kết bạn</h3>
              <button type="button" className="text-xs font-bold text-[#0052cc] hover:underline">
                Xem tất cả
              </button>
            </div>

            <div className="space-y-3">
              {goiYKetBan.map((item) => (
                <div key={item.ten} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#f6f9ff]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-[#d7e5ff] to-[#edf2ff] text-sm font-bold text-[#0052cc]">
                      {item.ten.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#191c1e]">{item.ten}</p>
                      <p className="text-[10px] text-[#727687]">{item.moTa}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-[#cfe0ff] bg-[#f1f6ff] px-3 py-1.5 text-xs font-bold text-[#0052cc] transition-colors hover:bg-[#e3edff]"
                  >
                    Thêm
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-[#dde6f8] bg-linear-to-br from-[#f5f8ff] to-[#eef3fb] p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5d6578]">Xu hướng</h3>
            {xuHuong.map((item) => (
              <div key={item.tag} className="rounded-xl px-2 py-1.5 transition-colors hover:bg-white/70">
                <p className="text-[10px] font-bold text-[#727687]">{item.tag}</p>
                <p className="mt-0.5 text-xs font-bold text-[#191c1e]">{item.tieuDe}</p>
                <p className="text-[10px] text-[#727687]">{item.soBaiViet}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#dde6f8] bg-white p-4 text-[10px] text-[#727687] shadow-sm">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <a href="#" className="hover:underline">Quyền riêng tư</a>
              <a href="#" className="hover:underline">Điều khoản</a>
              <a href="#" className="hover:underline">Quảng cáo</a>
              <a href="#" className="hover:underline">Hỗ trợ</a>
            </div>
            <p className="mt-3 text-[#8b91a4]">© 2026 Atrium Digital System</p>
          </div>
        </aside>
      </div>

      {isMobileRailOpen ? (
        <>
          <button
            type="button"
            aria-label="Đóng thanh điều hướng"
            className="fixed inset-0 z-40 bg-slate-900/35 md:hidden"
            onClick={() => setIsMobileRailOpen(false)}
          />
          <ChatAppRail
            activeNav="newsfeed"
            initials={currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : undefined}
            avatarUrl={currentUser.avatarUrl || undefined}
            mobileOpen
            onRequestClose={() => setIsMobileRailOpen(false)}
          />
        </>
      ) : null}

      {baiVietDangSua ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1730]/45 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onSuaBaiViet();
            }}
            className="w-full max-w-xl rounded-2xl border border-[#dce4f3] bg-white p-4 shadow-[0_20px_50px_rgba(13,33,85,0.32)]"
          >
            <h3 className="text-base font-bold text-[#1b2336]">Sửa bài viết</h3>
            <textarea
              value={noiDungSua}
              onChange={(event) => setNoiDungSua(event.target.value)}
              rows={6}
              className="mt-3 w-full resize-none rounded-xl border border-[#d7dff5] bg-[#f8faff] px-3 py-2 text-sm text-[#1d2742] outline-none transition-colors focus:border-[#4f7cff]"
              placeholder="Nhập nội dung bài viết"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={dangLuuSuaBaiViet}
                onClick={() => {
                  setBaiVietDangSua(null);
                  setNoiDungSua('');
                }}
                className="rounded-lg border border-[#d1daef] px-4 py-2 text-sm font-semibold text-[#4b5674] transition-colors hover:bg-[#f3f6fd] disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={dangLuuSuaBaiViet}
                className="rounded-lg bg-[#1d59df] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#184ec6] disabled:opacity-60"
              >
                {dangLuuSuaBaiViet ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {baiVietDangChiaSe ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1730]/45 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onChiaSe();
            }}
            className="w-full max-w-xl rounded-2xl border border-[#dce4f3] bg-white p-4 shadow-[0_20px_50px_rgba(13,33,85,0.32)]"
          >
            <h3 className="text-base font-bold text-[#1b2336]">Chia sẻ bài viết</h3>
            <p className="mt-1 text-xs text-[#6b7387]">Thêm nội dung đi kèm khi chia sẻ (có thể bỏ trống).</p>
            <textarea
              value={ghiChuChiaSe}
              onChange={(event) => setGhiChuChiaSe(event.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-[#d7dff5] bg-[#f8faff] px-3 py-2 text-sm text-[#1d2742] outline-none transition-colors focus:border-[#4f7cff]"
              placeholder="Viết gì đó về bài viết này"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={dangChiaSeBaiViet}
                onClick={() => {
                  setBaiVietDangChiaSe(null);
                  setGhiChuChiaSe('');
                }}
                className="rounded-lg border border-[#d1daef] px-4 py-2 text-sm font-semibold text-[#4b5674] transition-colors hover:bg-[#f3f6fd] disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={dangChiaSeBaiViet}
                className="rounded-lg bg-[#1d59df] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#184ec6] disabled:opacity-60"
              >
                {dangChiaSeBaiViet ? 'Đang chia sẻ...' : 'Chia sẻ'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {baiVietChoXoa ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1730]/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#dce4f3] bg-white p-4 shadow-[0_20px_50px_rgba(13,33,85,0.32)]">
            <h3 className="text-base font-bold text-[#1b2336]">Xóa bài viết</h3>
            <p className="mt-1 text-sm text-[#4f5870]">Bạn có chắc chắn muốn xóa bài viết này không?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={dangXoaBaiViet}
                onClick={() => setBaiVietChoXoa(null)}
                className="rounded-lg border border-[#d1daef] px-4 py-2 text-sm font-semibold text-[#4b5674] transition-colors hover:bg-[#f3f6fd] disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={dangXoaBaiViet}
                onClick={() => void onXoaBaiViet()}
                className="rounded-lg bg-[#be2a3b] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a52333] disabled:opacity-60"
              >
                {dangXoaBaiViet ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
