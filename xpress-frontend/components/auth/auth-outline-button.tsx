import type { ButtonHTMLAttributes } from "react";

type AuthOutlineButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function AuthOutlineButton({ label, className = "", ...props }: AuthOutlineButtonProps) {
  return (
    <button
      className={`flex h-[45px] w-full items-center justify-center rounded-[15px] border-2 border-[#36981d] bg-transparent text-[15px] font-bold text-[#36981d] transition hover:bg-[#36981d]/10 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {label}
    </button>
  );
}
