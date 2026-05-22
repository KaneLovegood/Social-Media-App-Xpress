"use client";

import { LogOut, MessageCircleMore, Newspaper, Settings, Users } from "lucide-react";
import Link from "next/link";

type ActiveNav = "newsfeed" | "chat" | "contacts" | "profile";

interface ChatAppRailProps {
  activeNav: ActiveNav;
  fixed?: boolean;
  initials?: string;
  avatarUrl?: string;
  onLogout?: () => void;
  mobileOpen?: boolean;
  onRequestClose?: () => void;
  contactsBadgeCount?: number;
}

const NAV_ITEMS = [
  {
    key: "chat" as ActiveNav,
    href: "/chat/me",
    icon: MessageCircleMore,
    title: "Tin nhắn",
  },
  {
    key: "contacts" as ActiveNav,
    href: "/chat/contacts",
    icon: Users,
    title: "Danh bạ",
  },
  {
    key: "newsfeed" as ActiveNav,
    href: "/chat/news-feed",
    icon: Newspaper,
    title: "Bản tin",
  },
  {
    key: "profile" as ActiveNav,
    href: "/chat/profile",
    icon: Settings,
    title: "Cài đặt cá nhân",
  },
];

export default function ChatAppRail({
  activeNav,
  fixed = false,
  initials,
  avatarUrl,
  onLogout,
  mobileOpen = false,
  onRequestClose,
  contactsBadgeCount,
}: ChatAppRailProps) {
  const railPositionClass = mobileOpen
    ? "fixed left-0 top-0 z-50 flex md:hidden"
    : `${fixed ? "fixed left-0 top-0" : ""} hidden md:flex`;

  return (
    <aside
      className={`${railPositionClass} h-full w-16 flex-col items-center bg-[#e7e8ea] py-4`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="User avatar"
          className="mb-8 h-10 w-10 rounded-full object-cover"
        />
      ) : initials ? (
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-[#dae2ff] font-bold text-[#0040a2]">
          {initials}
        </div>
      ) : (
        <div className="mb-8 h-10 w-10 rounded-full bg-zinc-300" />
      )}

      {NAV_ITEMS.map(({ key, href, icon: Icon, title }, index) => {
        const isActive = activeNav === key;

        return (
          <Link
            key={key}
            href={href}
            title={title}
            onClick={onRequestClose}
            className={`${
              index !== 0 ? "mt-3" : ""
            } rounded-lg p-3 relative ${
              isActive
                ? "bg-linear-to-br from-[#0052cc] to-[#0068ff] text-white"
                : "text-zinc-500 hover:bg-[#e1e2e4]"
            }`}
          >
            <Icon className="h-5 w-5" />
            {key === "contacts" && contactsBadgeCount !== undefined && contactsBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-[#e7e8ea]">
                {contactsBadgeCount}
              </span>
            )}
          </Link>
        );
      })}

      {onLogout && (
        <button
          type="button"
          onClick={() => {
            onLogout();
            onRequestClose?.();
          }}
          className="mt-auto rounded-lg p-3 text-zinc-500 hover:bg-[#e1e2e4]"
          title="Đăng xuất"
        >
          <LogOut className="h-5 w-5" />
        </button>
      )}
    </aside>
  );
}