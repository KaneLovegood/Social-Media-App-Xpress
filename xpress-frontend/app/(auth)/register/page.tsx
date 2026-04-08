"use client";

import { register } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ name, phone, password });
      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="text-sm font-medium text-[#f25019]">Your logo</p>
      <h1 className="mt-1 text-5xl font-bold leading-tight text-[#333333]">Register</h1>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-[#333333]">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Nam"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="block text-sm font-medium text-[#333333]">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="0901234567"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-[#333333]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Pass1234"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
          />
        </div>
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614]"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#333333]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#ae4700]">
          Sign in
        </Link>
      </p>
    </>
  );
}
