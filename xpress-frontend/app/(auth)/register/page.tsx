"use client";

import { AuthErrorMessage } from "@/components/auth/auth-footer-link";
import { AuthField } from "@/components/auth/auth-field";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthOutlineButton } from "@/components/auth/auth-outline-button";
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
  const [confirmPassword, setConfirmPassword] = useState("");
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
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length >= 8 &&
    password === confirmPassword;

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
      if (password !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp.");
        return;
      }
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
      <AuthHeading
        title="Đăng ký"
        subtitle="Vui lòng nhập họ tên, email và mật khẩu của bạn"
      />

      <form className="space-y-[22px]" onSubmit={handleSubmit}>
        {step === "account" ? (
          <div className="space-y-[22px]">
            <AuthField
              id="name"
              icon="user"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <AuthField
              id="email"
              icon="user"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <AuthField
              id="password"
              icon="lock"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mật khẩu"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="space-y-2">
              <AuthField
                id="confirmPassword"
                icon="lock"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
          <div className="space-y-4">
            <div className="rounded-[15px] border border-white/40 bg-white/10 px-4 py-3 text-xs text-white">
              <p>
                Xác thực email: <span className="font-bold">{email}</span>
              </p>
              <button
                type="button"
                onClick={handleBackToAccount}
                className="mt-1 font-bold text-[#18a6c6] underline"
              >
                Sửa thông tin đăng ký
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-white">Mã OTP (4 số)</p>
              <div className="flex flex-wrap items-center gap-2">
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
                    className="h-11 w-11 rounded-[15px] border border-white bg-transparent text-center text-lg font-bold text-white outline-none focus:ring-2 focus:ring-[#18a6c6]"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => void handleQuickPaste()}
                  className="h-10 rounded-[15px] border border-[#18a6c6] px-3 text-xs font-bold text-[#18a6c6] hover:bg-[#18a6c6]/10"
                >
                  Dán nhanh
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleSendOtp()}
                disabled={sendingOtp}
                className="h-10 rounded-[15px] border border-[#18a6c6] px-3 text-xs font-bold text-[#18a6c6] hover:bg-[#18a6c6]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingOtp ? "Đang gửi..." : "Gửi lại"}
              </button>
              {otpStatus ? <p className="text-xs text-[#7ee0f7]">{otpStatus}</p> : null}
            </div>
          </div>
        )}

        {error ? <AuthErrorMessage>{error}</AuthErrorMessage> : null}

        {step === "account" ? (
          <AuthOutlineButton
            type="button"
            label={sendingOtp ? "Đang gửi OTP..." : "Xác thực email"}
            disabled={sendingOtp}
            onClick={() => void handleContinueToOtp()}
          />
        ) : (
          <AuthOutlineButton
            type="submit"
            label={loading ? "Đang xác thực..." : "Xác thực"}
            disabled={loading || otpCode.length !== OTP_LENGTH}
          />
        )}
      </form>

      <AuthFooterLink
        className="mt-8"
        prefix="Đã có tài khoản?"
        linkLabel="Đăng nhập"
        href="/login"
      />
    </>
  );
}
