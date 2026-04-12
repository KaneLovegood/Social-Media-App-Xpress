"use client";

import InstagramLoginInputs from "@/components/instagram-login-inputs";
import { login } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ phone, password });
      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="text-sm font-medium text-[#f25019]">Your logo</p>
      <h1 className="mt-1 text-5xl font-bold leading-tight text-[#333333]">Login</h1>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <InstagramLoginInputs
          phone={phone}
          password={password}
          onPhoneChange={setPhone}
          onPasswordChange={setPassword}
        />

        <div className="text-right text-sm font-medium tracking-wide text-[#ae4700]">
          Forgot Password?
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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#333333]">Or Continue With</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#333333]"
        >
          G
        </button>
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#333333]"
        >
          GH
        </button>
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#1e7bd6]"
        >
          f
        </button>
      </div>

      <p className="mt-9 text-center text-sm text-[#333333]">
        Don&apos;t have an account yet?{" "}
        <Link href="/register" className="font-semibold text-[#ae4700]">
          Register for free
        </Link>
      </p>
    </>
  );
}
