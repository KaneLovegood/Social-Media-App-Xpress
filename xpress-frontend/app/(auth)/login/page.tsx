"use client";

import InstagramLoginInputs from "@/components/instagram-login-inputs";
import { login, loginWithGoogle } from "@/lib/auth";
import { consumeAuthNotice } from "@/lib/auth-client";
import { signInWithGoogle } from "@/lib/google-auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prefetchedEmail = searchParams.get("email")?.trim() ?? "";
    if (prefetchedEmail) {
      setEmail(prefetchedEmail);
    }
  }, [searchParams]);

  useEffect(() => {
    const authNotice = consumeAuthNotice();
    if (authNotice) {
      toast.error(authNotice);
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      router.push("/chat/me");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = useCallback(async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const { idToken, platform } = await signInWithGoogle();
      // console.log("idToken", idToken);
      // console.log("platform", platform);
      await loginWithGoogle(idToken, { platform });
      router.push("/chat/me");
      router.refresh();
    } catch (googleError) {
      setError(
        googleError instanceof Error
          ? googleError.message
          : "Đăng nhập Google thất bại.",
      );
    } finally {
      setGoogleLoading(false);
    }
  }, [router]);

  return (
    <>
      <p className="text-sm font-medium text-[#f25019]">Xpress</p>
      <h1 className="mt-1 text-5xl font-bold leading-tight text-[#333333]">Đăng nhập</h1>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <InstagramLoginInputs
          email={email}
          password={password}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />

        <div className="text-right text-sm font-medium tracking-wide text-[#ae4700]">
          <Link
            href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
            className="hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614]"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#333333]">Hoặc tiếp tục với</p>

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={googleLoading}
          className="flex h-10 w-[320px] items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white text-sm font-medium text-[#3c4043] transition hover:bg-[#f7f8f9] disabled:opacity-60"
        >
          <GoogleGlyph />
          {googleLoading ? "Đang kết nối Google..." : "Tiếp tục với Google"}
        </button>
      </div>

      <p className="mt-9 text-center text-sm text-[#333333]">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-[#ae4700]">
          Đăng ký ngay
        </Link>
      </p>
    </>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <LoginContent />
    </Suspense>
  );
}
