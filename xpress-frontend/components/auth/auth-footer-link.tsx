import Link from "next/link";
import type { ReactNode } from "react";

type AuthFooterLinkProps = {
  prefix: string;
  linkLabel: string;
  href: string;
  className?: string;
};

export function AuthFooterLink({ prefix, linkLabel, href, className = "" }: AuthFooterLinkProps) {
  return (
    <p className={`text-center text-[14px] font-bold text-white ${className}`}>
      {prefix}{" "}
      <Link href={href} className="italic text-[#18a6c6] hover:underline">
        {linkLabel}
      </Link>
    </p>
  );
}

type AuthErrorMessageProps = {
  children: ReactNode;
};

export function AuthErrorMessage({ children }: AuthErrorMessageProps) {
  return (
    <p className="rounded-[10px] border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">
      {children}
    </p>
  );
}
