import { Suspense } from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4 py-8 text-sm text-slate-600">
        Đang tải trang Quên mật khẩu...
      </div>
    }>
      <ForgotPasswordClient />
    </Suspense>
  );
}
