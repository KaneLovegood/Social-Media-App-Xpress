"use client";

import { LogOut, MessageCircleMore, Settings, Users } from "lucide-react";
import Link from "next/link";

type ActiveNav = "chat" | "contacts" | "profile";

interface ChatAppRailProps {
  activeNav: ActiveNav;
  fixed?: boolean;
  initials?: string;
  onLogout?: () => void;
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
  onLogout,
}: ChatAppRailProps) {
  return (
    <aside
      className={`${
        fixed ? "fixed left-0 top-0" : ""
      } hidden h-full w-16 flex-col items-center bg-[#e7e8ea] py-4 md:flex`}
    >
      {initials ? (
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
            className={`${
              index !== 0 ? "mt-3" : ""
            } rounded-lg p-3 ${
              isActive
                ? "bg-linear-to-br from-[#0052cc] to-[#0068ff] text-white"
                : "text-zinc-500 hover:bg-[#e1e2e4]"
            }`}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="mt-auto rounded-lg p-3 text-zinc-500 hover:bg-[#e1e2e4]"
          title="Đăng xuất"
        >
          <LogOut className="h-5 w-5" />
        </button>
      )}
    </aside>
  );
}