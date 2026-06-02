"use client";

import { AuthErrorMessage, AuthFooterLink } from "@/components/auth/auth-footer-link";
import { AuthField } from "@/components/auth/auth-field";
import { AuthGoogleButton } from "@/components/auth/auth-google-button";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthOutlineButton } from "@/components/auth/auth-outline-button";
import {
  isTwoFactorChallenge,
  login,
  loginWithGoogle,
  verifyTwoFactorLogin,
  type TwoFactorChallenge,
} from "@/lib/auth";
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
  const [twoFactorChallenge, setTwoFactorChallenge] =
    useState<TwoFactorChallenge | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prefetchedEmail = searchParams.get("email")?.trim() ?? "";
    if (prefetchedEmail) {
      const timeoutId = window.setTimeout(() => {
        setEmail(prefetchedEmail);
      }, 0);
      return () => window.clearTimeout(timeoutId);
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

    if (twoFactorChallenge) {
      if (otpCode.trim().length !== 4) {
        setError("Vui lòng nhập đủ 4 số OTP.");
        return;
      }

      setVerifyingOtp(true);
      try {
        await verifyTwoFactorLogin({
          twoFactorToken: twoFactorChallenge.twoFactorToken,
          code: otpCode.trim(),
        });
        router.push("/chat/me");
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Xác thực OTP thất bại.",
        );
      } finally {
        setVerifyingOtp(false);
      }
      return;
    }

    setLoading(true);
    try {
      const result = await login({ email, password });
      if (isTwoFactorChallenge(result)) {
        setTwoFactorChallenge(result);
        setOtpCode("");
        return;
      }
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
      const result = await loginWithGoogle(idToken, { platform });
      if (isTwoFactorChallenge(result)) {
        setTwoFactorChallenge(result);
        setOtpCode("");
        return;
      }
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
        title={twoFactorChallenge ? "Xác thực OTP" : "Đăng nhập"}
        subtitle={
          twoFactorChallenge
            ? `Nhập mã OTP đã gửi tới ${twoFactorChallenge.email}`
            : "Vui lòng nhập email và mật khẩu của bạn"
        }
      />

      <form className="space-y-[22px]" onSubmit={handleSubmit}>
        {!twoFactorChallenge ? (
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
        ) : (
          <div className="space-y-3">
            <input
              id="twoFactorOtp"
              name="twoFactorOtp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              required
              value={otpCode}
              onChange={(event) =>
                setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-11 w-full rounded-md border border-transparent bg-white px-4 text-center text-lg font-bold tracking-[0.25em] text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
              placeholder="0000"
            />
            <button
              type="button"
              onClick={() => {
                setTwoFactorChallenge(null);
                setOtpCode("");
                setError("");
              }}
              className="text-xs font-semibold text-white underline"
            >
              Quay lại đăng nhập
            </button>
          </div>
        )}

        {error ? <AuthErrorMessage>{error}</AuthErrorMessage> : null}

        <AuthOutlineButton
          type="submit"
          label={
            twoFactorChallenge
              ? verifyingOtp
                ? "Đang xác thực..."
                : "Xác thực OTP"
              : loading
                ? "Đang đăng nhập..."
                : "Đăng nhập"
          }
          disabled={loading || verifyingOtp}
          className="!cursor-pointer"
        />

        {!twoFactorChallenge ? (
          <AuthGoogleButton
            label={googleLoading ? "Đang kết nối Google..." : "Hoặc đăng nhập với Google"}
            disabled={googleLoading}
            onClick={() => void handleGoogleClick()}
          />
        ) : null}
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
