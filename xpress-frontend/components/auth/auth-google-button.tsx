import { AuthGoogleIcon } from "@/components/auth/auth-icons";
import type { ButtonHTMLAttributes } from "react";

type AuthGoogleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function AuthGoogleButton({ label, className = "", ...props }: AuthGoogleButtonProps) {
  return (
    <button
      type="button"
      className={`flex h-[45px] w-full items-center justify-center gap-3 rounded-[15px] bg-[#1a1b22] text-[14px] font-bold text-white transition hover:bg-[#25262f] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      <AuthGoogleIcon />
      {label}
    </button>
  );
}
