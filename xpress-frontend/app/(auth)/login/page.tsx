"use client";

import { AuthErrorMessage, AuthFooterLink } from "@/components/auth/auth-footer-link";
import { AuthField } from "@/components/auth/auth-field";
import { AuthGoogleButton } from "@/components/auth/auth-google-button";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthOutlineButton } from "@/components/auth/auth-outline-button";
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
      <AuthHeading
        title="Đăng nhập"
        subtitle="Vui lòng nhập email và mật khẩu của bạn"
      />

      <form className="space-y-[22px]" onSubmit={handleSubmit}>
        <div className="space-y-[22px]">
          <AuthField
            id="email"
            icon="user"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Tên đăng nhập hoặc email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <div className="space-y-2">
            <AuthField
              id="password"
              icon="lock"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Mật khẩu"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-right text-[10px] text-white">
              <Link
                href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
                className="hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </p>
          </div>
        </div>

        {error ? <AuthErrorMessage>{error}</AuthErrorMessage> : null}

        <AuthOutlineButton
          type="submit"
          label={loading ? "Đang đăng nhập..." : "Đăng nhập"}
          disabled={loading}
          className="!cursor-pointer"
        />

        <AuthGoogleButton
          label={googleLoading ? "Đang kết nối Google..." : "Hoặc đăng nhập với Google"}
          disabled={googleLoading}
          onClick={() => void handleGoogleClick()}
        />
      </form>

      <AuthFooterLink
        className="mt-8"
        prefix="Chưa có tài khoản?"
        linkLabel="Đăng ký ngay"
        href="/register"
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm font-bold text-white">Đang tải...</p>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
