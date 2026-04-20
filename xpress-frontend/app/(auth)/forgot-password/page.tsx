"use client";

import { resetPassword, sendEmailOtp, verifyEmailOtp } from "@/lib/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }, () => ""),
  );
  const [otpStatus, setOtpStatus] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otpCode = useMemo(() => otpDigits.join(""), [otpDigits]);

  useEffect(() => {
    const prefetchedEmail = searchParams.get("email")?.trim() ?? "";
    if (prefetchedEmail) {
      setEmail(prefetchedEmail);
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendCooldown]);

  const handleContinueToOtp = async () => {
    setError("");
    setSuccess("");
    setOtpStatus("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Vui lòng nhập email.");
      return;
    }

    setSendingOtp(true);
    try {
      await sendEmailOtp({ email: normalizedEmail, purpose: "CHANGE_PASSWORD" });
      setStep("otp");
      setOtpToken("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtpStatus("Đã gửi OTP. Vui lòng kiểm tra email của bạn.");
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gửi OTP thất bại.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSendOtpAgain = async () => {
    setError("");
    setSuccess("");
    setOtpStatus("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Vui lòng nhập email trước khi gửi OTP.");
      return;
    }
    if (resendCooldown > 0) {
      setError(
        `Bạn chỉ có thể gửi lại OTP sau ${formatCountdown(resendCooldown)}.`,
      );
      return;
    }

    setSendingOtp(true);
    try {
      await sendEmailOtp({ email: normalizedEmail, purpose: "CHANGE_PASSWORD" });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtpStatus("Đã gửi lại OTP. Vui lòng kiểm tra email của bạn.");
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      otpInputRefs.current[0]?.focus();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gửi OTP thất bại.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleBackToEmailStep = () => {
    setStep("email");
    setOtpToken("");
    setError("");
    setSuccess("");
    setOtpStatus("");
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setResendCooldown(0);
  };

  const handleBackToOtpStep = () => {
    setStep("otp");
    setError("");
    setSuccess("");
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

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail || otpCode.length !== OTP_LENGTH) {
      setError(`Vui lòng nhập đủ ${OTP_LENGTH} số OTP.`);
      return;
    }

    setVerifyingOtp(true);
    try {
      const verifyResult = await verifyEmailOtp({
        email: normalizedEmail,
        code: otpCode,
        purpose: "CHANGE_PASSWORD",
      });
      setOtpToken(verifyResult.otpToken);
      setStep("password");
      setSuccess("OTP hợp lệ. Bạn có thể đặt mật khẩu mới.");
      setOtpStatus("");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Xác thực OTP thất bại.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (step === "email") {
      await handleContinueToOtp();
      return;
    }

    if (step === "otp") {
      await handleVerifyOtp();
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email không hợp lệ.");
      return;
    }

    if (!otpToken) {
      setError("OTP chưa được xác thực. Vui lòng xác thực OTP trước.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    setResettingPassword(true);
    try {
      await resetPassword({
        email: normalizedEmail,
        otpToken,
        newPassword,
      });
      setSuccess("Đổi mật khẩu thành công. Đang chuyển đến trang đăng nhập...");
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(normalizedEmail)}`);
        router.refresh();
      }, 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Đặt lại mật khẩu thất bại.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <>
      <p className="text-sm font-medium text-[#f25019]">Xpress</p>
      <h1 className="mt-1 text-4xl font-bold leading-tight text-[#333333]">Quên mật khẩu</h1>
      <p className="mt-2 text-sm text-[#727687]">
        Nhập email để nhận OTP. Sau khi xác thực OTP thành công, bạn mới được đổi mật khẩu.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {step === "email" ? (
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
        ) : null}

        {step === "otp" ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[#ffd8c2] bg-[#fff7f2] px-3 py-2 text-xs text-[#8f4b1f]">
              <p>
                Xác thực email: <span className="font-semibold">{email}</span>
              </p>
              <button
                type="button"
                onClick={handleBackToEmailStep}
                className="mt-1 font-semibold text-[#f25019] underline"
              >
                Sửa email
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
                  onClick={() => void handleSendOtpAgain()}
                  disabled={sendingOtp || resendCooldown > 0}
                  className="h-10 rounded-md border border-[#f25019] px-3 text-xs font-semibold text-[#f25019] hover:bg-[#fff0e8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingOtp
                    ? "Đang gửi..."
                    : resendCooldown > 0
                      ? `Gửi lại sau ${formatCountdown(resendCooldown)}`
                      : "Gửi lại"}
                </button>
              </div>
              {otpStatus ? <p className="text-xs text-emerald-700">{otpStatus}</p> : null}
            </div>
          </div>
        ) : null}

        {step === "password" ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <p>
                OTP đã xác thực cho email: <span className="font-semibold">{email}</span>
              </p>
              <button
                type="button"
                onClick={handleBackToOtpStep}
                className="mt-1 font-semibold underline"
              >
                Xác thực lại OTP
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-sm font-medium text-[#333333]">
                Mật khẩu mới
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Tối thiểu 8 ký tự"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#333333]">
                Xác nhận mật khẩu mới
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        {step === "email" ? (
          <button
            type="submit"
            disabled={sendingOtp}
            className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingOtp ? "Đang gửi OTP..." : "Nhận mã OTP"}
          </button>
        ) : null}

        {step === "otp" ? (
          <button
            type="submit"
            disabled={verifyingOtp || otpCode.length !== OTP_LENGTH}
            className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifyingOtp ? "Đang xác thực..." : "Xác thực OTP"}
          </button>
        ) : null}

        {step === "password" ? (
          <button
            type="submit"
            disabled={resettingPassword}
            className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resettingPassword ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
          </button>
        ) : null}
      </form>

      <p className="mt-6 text-center text-sm text-[#333333]">
        Nhớ mật khẩu rồi?{" "}
        <Link href="/login" className="font-semibold text-[#ae4700]">
          Quay lại đăng nhập
        </Link>
      </p>
    </>
  );
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
