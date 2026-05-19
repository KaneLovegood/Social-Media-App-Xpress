import { AuthShell } from "@/components/auth/auth-shell";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthShell>{children}</AuthShell>;
}
