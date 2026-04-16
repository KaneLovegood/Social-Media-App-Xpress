"use client";

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Shield, Lock, Bell, TextAlignJustify } from 'lucide-react';
import ChatAppRail from '@/components/chat/ChatAppRail';
import { getProfileModel } from '@/modules/profile/profile.service';

const noopSubscribe = () => () => {};

function StatusDot({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  if (status === 'online') {
    return <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />;
  }

  if (status === 'offline') {
    return <span className="h-3 w-3 rounded-full bg-zinc-400 ring-2 ring-white" />;
  }

  return <span className="h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />;
}

export default function ProfileScreen() {
  const isHydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const profile = useMemo(() => (isHydrated ? getProfileModel() : null), [isHydrated]);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);

  if (!isHydrated || !profile) {
    return <section className="h-full w-full bg-[#f3f4f6]" />;
  }

  return (
    <section className="flex h-full w-full flex-col overflow-y-auto bg-[#f3f4f6]">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e1e2e4] bg-[#f8f9fb]/95 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileRailOpen(true)}
              className="rounded-full p-2 text-zinc-700 hover:bg-slate-100 md:hidden"
              aria-label="Mở thanh điều hướng"
            >
              <TextAlignJustify className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-[#191c1e] lg:text-xl">Cài đặt & Cá nhân</h1>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)] sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#0052cc] to-[#3d83ff] text-2xl font-black text-white shadow-lg">
                  {profile.initials}
                  <span className="absolute bottom-1 right-1">
                    <StatusDot status={profile.status} />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-black tracking-tight text-[#191c1e]">{profile.displayName}</h2>
                  <p className="mt-1 text-sm font-medium text-[#727687]">{profile.email}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-[#dae2ff] px-3 py-1.5 text-xs font-semibold text-[#0040a2]">
                      Vai trò: {profile.roleLabel == "CUSTOMER" ? "Người dùng" : "Admin"}
                    </span>
                    <span className="rounded-lg bg-[#ffdbcf] px-3 py-1.5 text-xs font-semibold text-[#812800]">
                      Trạng thái: {profile.statusLabel}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-xl bg-linear-to-br from-[#425c9f] to-[#0052cc] p-6 text-white shadow-lg sm:p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Cloud Storage</h3>
              <p className="mt-2 text-3xl font-black">{profile.storageUsedPercent}%</p>
              <p className="mt-1 text-sm text-white/85">Dung lượng đang sử dụng</p>

              <div className="mt-5 h-2 w-full rounded-full bg-white/25">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${profile.storageUsedPercent}%` }}
                />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/85">
                Hãy kiểm tra và dọn dẹp media thường xuyên
              </p>
            </article>
          </section>

          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)]">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                  <Shield className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#191c1e]">Account & Security</h3>
              </div>
              <ul className="space-y-3 text-sm text-[#424655]">
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Đổi mật khẩu</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Xác thực 2 bước: Tắt</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Quản lý phiên đăng nhập</li>
              </ul>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)]">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                  <Lock className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#191c1e]">Quyền riêng tư</h3>
              </div>
              <ul className="space-y-3 text-sm text-[#424655]">
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Hiển thị trạng thái: Mọi người</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Đã chặn: 0 tài khoản</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Biên nhận đã xem: Bật</li>
              </ul>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)] md:col-span-2 xl:col-span-1">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                  <Bell className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#191c1e]">Thông báo</h3>
              </div>
              <ul className="space-y-3 text-sm text-[#424655]">
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Tin nhắn mới</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Lời mời kết bạn</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Cập nhật bảo mật</li>
              </ul>
            </article>
          </section>
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
              activeNav="profile"
              initials={profile.initials || undefined}
              mobileOpen
              onRequestClose={() => setIsMobileRailOpen(false)}
            />
          </>
        ) : null}
    </section>
  );
}
