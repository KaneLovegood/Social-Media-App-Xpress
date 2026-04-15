"use client";

import InstagramLoginInputs from "@/components/instagram-login-inputs";
import { getGoogleClientId, login, loginWithGoogle } from "@/lib/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              width?: number;
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
            },
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [error, setError] = useState("");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = getGoogleClientId();

  useEffect(() => {
    const prefetchedEmail = searchParams.get("email")?.trim() ?? "";
    if (prefetchedEmail) {
      setEmail(prefetchedEmail);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!googleClientId) return;
    if (window.google?.accounts?.id) {
      setGoogleScriptReady(true);
    }
  }, [googleClientId]);

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

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleLoading(true);
    setError("");
    try {
      await loginWithGoogle(credential);
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

  useEffect(() => {
    if (!googleClientId) return;
    if (!googleScriptReady) return;
    if (!window.google?.accounts?.id) return;
    if (!googleButtonRef.current) return;

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (!response.credential) {
          setError("Không nhận được Google credential.");
          return;
        }
        void handleGoogleCredential(response.credential);
      },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
      shape: "pill",
    });
  }, [googleClientId, googleScriptReady, handleGoogleCredential]);

  return (
    <>
      {googleClientId ? (
        <Script
          id="google-identity-client"
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setGoogleScriptReady(true)}
          onReady={() => setGoogleScriptReady(true)}
        />
      ) : null}
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
          Quên mật khẩu?
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
        {googleClientId ? (
          <div ref={googleButtonRef} className="min-h-[40px]" />
        ) : (
          <p className="text-xs text-amber-700">
            Thiếu `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nên chưa hiển thị nút đăng nhập Google.
          </p>
        )}
        {googleLoading ? (
          <p className="text-xs text-[#727687]">Đang xác thực Google...</p>
        ) : null}
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
