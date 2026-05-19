import { AuthAntigravityBackground } from "@/components/auth/auth-antigravity-background";
import { PT_Sans } from "next/font/google";
import Image from "next/image";
import type { ReactNode } from "react";

const ptSans = PT_Sans({
  weight: ["400", "700"],
  subsets: ["latin"],
  style: ["normal", "italic"],
});

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1f41a9] px-4 py-10 ${ptSans.className}`}
    >
      <AuthAntigravityBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <Image
          src="/assets/auth/bg-blobs.svg"
          alt=""
          width={1828}
          height={1475}
          priority
          className="absolute left-1/2 top-1/2 h-[min(1475px,160vh)] w-[min(1828px,200vw)] max-w-none -translate-x-[42%] -translate-y-[48%] object-cover opacity-100"
        />
      </div>
      <div className="relative z-10 w-full max-w-[352px]">{children}</div>
    </main>
  );
}
