"use client";

import { register, sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";

const OTP_LENGTH = 4;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"account" | "otp">("account");
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }, () => ""),
  );
  const [otpStatus, setOtpStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState("");
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otpCode = useMemo(() => otpDigits.join(""), [otpDigits]);
  const canContinueToOtp =
    name.trim().length > 0 && email.trim().length > 0 && password.trim().length >= 8;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (step !== "otp") {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail || otpCode.length !== OTP_LENGTH) {
      setError(`Vui lòng nhập đủ ${OTP_LENGTH} số OTP.`);
      return;
    }

    setLoading(true);
    try {
      const verifyResult = await verifyEmailOtp({
        email: normalizedEmail,
        code: otpCode,
        purpose: "REGISTER",
      });
      await register({ name, email: normalizedEmail, password, otpToken: verifyResult.otpToken });
      router.push(`/login?email=${encodeURIComponent(normalizedEmail)}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToOtp = async () => {
    setError("");
    setOtpStatus("");

    if (!canContinueToOtp) {
      setError("Vui lòng nhập đầy đủ tên, email và mật khẩu (tối thiểu 8 ký tự).");
      return;
    }

    const normalizedEmail = email.trim();
    setSendingOtp(true);
    try {
      await sendEmailOtp({ email: normalizedEmail, purpose: "REGISTER" });
      setStep("otp");
      setOtpStatus("Đã gửi OTP. Vui lòng kiểm tra email của bạn.");
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gửi OTP thất bại.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleBackToAccount = () => {
    setStep("account");
    setError("");
    setOtpStatus("");
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
  };

  const handleSendOtp = async () => {
    setError("");
    setOtpStatus("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Vui lòng nhập email trước khi gửi OTP.");
      return;
    }

    setSendingOtp(true);
    try {
      await sendEmailOtp({ email: normalizedEmail, purpose: "REGISTER" });
      setOtpStatus("Đã gửi OTP. Vui lòng kiểm tra email của bạn.");
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      otpInputRefs.current[0]?.focus();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gửi OTP thất bại.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const numeric = value.replace(/\D/g, "");
    const nextChar = numeric.slice(-1);

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = nextChar;
      return next;
    });

    if (nextChar && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const fillOtpFromText = (text: string) => {
    const numbers = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!numbers) {
      setError("Không tìm thấy mã OTP hợp lệ để dán.");
      return;
    }

    const nextDigits = Array.from({ length: OTP_LENGTH }, (_, index) => numbers[index] ?? "");
    setOtpDigits(nextDigits);
    if (numbers.length === OTP_LENGTH) {
      otpInputRefs.current[OTP_LENGTH - 1]?.focus();
    } else {
      otpInputRefs.current[numbers.length]?.focus();
    }
  };

  const handleQuickPaste = async () => {
    setError("");
    try {
      const clipboard = await navigator.clipboard.readText();
      fillOtpFromText(clipboard);
    } catch {
      setError("Không thể đọc clipboard. Hãy dán thủ công.");
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    fillOtpFromText(pasted);
  };

  return (
    <>
      <p className="text-sm font-medium text-[#f25019]">Xpress</p>
      <h1 className="mt-1 text-5xl font-bold leading-tight text-[#333333]">Đăng ký</h1>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        {step === "account" ? (
          <>
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-[#333333]">
                Họ và tên
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
              <label htmlFor="email" className="block text-sm font-medium text-[#333333]">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#333333]">
                Mật khẩu
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
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-[#ffd8c2] bg-[#fff7f2] px-3 py-2 text-xs text-[#8f4b1f]">
              <p>
                Xác thực email: <span className="font-semibold">{email}</span>
              </p>
              <button
                type="button"
                onClick={handleBackToAccount}
                className="mt-1 font-semibold text-[#f25019] underline"
              >
                Sửa thông tin đăng ký
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#333333]">
                Mã OTP (4 số)
              </label>
              <div className="flex items-center gap-2">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpInputRefs.current[index] = element;
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    onPaste={handleOtpPaste}
                    className="h-11 w-11 rounded-md border border-transparent bg-white text-center text-lg font-semibold text-[#333333] outline-none ring-orange-300 focus:ring-2"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => void handleQuickPaste()}
                  className="ml-1 h-10 rounded-md border border-[#f25019] px-3 text-xs font-semibold text-[#f25019] hover:bg-[#fff0e8]"
                >
                  Dán nhanh
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleSendOtp()}
                  disabled={sendingOtp}
                  className="h-10 rounded-md border border-[#f25019] px-3 text-xs font-semibold text-[#f25019] hover:bg-[#fff0e8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingOtp ? "Đang gửi..." : "Gửi lại"}
                </button>
              </div>
              {otpStatus ? <p className="text-xs text-emerald-700">{otpStatus}</p> : null}
            </div>
          </div>
        )}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {step === "account" ? (
          <button
            type="button"
            onClick={() => void handleContinueToOtp()}
            disabled={sendingOtp}
            className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingOtp ? "Đang gửi OTP..." : "Xác thực email"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || otpCode.length !== OTP_LENGTH}
            className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang xác thực..." : "Xác thực"}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-[#333333]">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold text-[#ae4700]">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
