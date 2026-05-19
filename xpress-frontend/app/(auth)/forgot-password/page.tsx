import { Suspense } from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center px-4 py-8 text-sm font-bold text-white">
        Đang tải trang Quên mật khẩu...
      </div>
    }>
      <ForgotPasswordClient />
    </Suspense>
  );
}
