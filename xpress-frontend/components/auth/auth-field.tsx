import { AuthLockIcon, AuthUserIcon } from "@/components/auth/auth-icons";
import type { InputHTMLAttributes } from "react";

type AuthFieldIcon = "user" | "lock";

type AuthFieldProps = {
  id: string;
  icon: AuthFieldIcon;
  placeholder: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | "name"
  | "type"
  | "value"
  | "onChange"
  | "required"
  | "autoComplete"
  | "inputMode"
  | "maxLength"
  | "onKeyDown"
  | "onPaste"
>;

const fieldIcons: Record<AuthFieldIcon, typeof AuthUserIcon> = {
  user: AuthUserIcon,
  lock: AuthLockIcon,
};

export function AuthField({
  id,
  icon,
  placeholder,
  type = "text",
  ...inputProps
}: AuthFieldProps) {
  const FieldIcon = fieldIcons[icon];

  return (
    <label
      htmlFor={id}
      className="relative flex h-[45px] w-full items-center rounded-[15px] border border-white bg-transparent"
    >
      <span className="pointer-events-none absolute left-[11px] flex size-[37px] items-center justify-center">
        <FieldIcon />
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className="h-full w-full rounded-[15px] bg-transparent pr-4 pl-[52px] text-[15px] font-bold text-white outline-none placeholder:text-[#a5a5a5]"
        {...inputProps}
      />
    </label>
  );
}
