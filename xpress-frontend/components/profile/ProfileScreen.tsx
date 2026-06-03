"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Bell,
  Camera,
  Check,
  KeyRound,
  Lock,
  Pencil,
  Shield,
  ShieldCheck,
  TextAlignJustify,
  X,
} from 'lucide-react';
import ChatAppRail from '@/components/chat/ChatAppRail';
import {
  changeProfilePassword,
  disableTwoFactor,
  enableTwoFactor,
  getProfileModel,
  sendTwoFactorDisableOtp,
  sendTwoFactorSetupOtp,
  updateProfileAvatar,
  updateProfileInfo,
} from '@/modules/profile/profile.service';

const noopSubscribe = () => () => {};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type TwoFactorMode = 'enable' | 'disable';

type ProfileForm = {
  name: string;
};

function StatusDot({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  if (status === 'online') {
    return <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />;
  }

  if (status === 'offline') {
    return <span className="h-3 w-3 rounded-full bg-zinc-400 ring-2 ring-white" />;
  }

  return <span className="h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />;
}

export default function ProfileScreen() {
  const isHydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [profile, setProfile] = useState<ReturnType<typeof getProfileModel> | null>(null);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [isSendingTwoFactorOtp, setIsSendingTwoFactorOtp] = useState(false);
  const [isSubmittingTwoFactor, setIsSubmittingTwoFactor] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState<TwoFactorMode>('enable');
  const [twoFactorOtp, setTwoFactorOtp] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('');
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
  });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const profileDialogRef = useRef<HTMLDivElement | null>(null);
  const passwordDialogRef = useRef<HTMLDivElement | null>(null);
  const twoFactorDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    const timeoutId = window.setTimeout(() => {
      setProfile(getProfileModel());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isHydrated]);

  useEffect(() => {
    if (!isProfileModalOpen && !isPasswordModalOpen && !isTwoFactorModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusId = window.setTimeout(() => {
      if (isProfileModalOpen) profileDialogRef.current?.focus();
      if (isPasswordModalOpen) passwordDialogRef.current?.focus();
      if (isTwoFactorModalOpen) twoFactorDialogRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !isSavingProfile &&
        !isChangingPassword &&
        !isSubmittingTwoFactor &&
        !isSendingTwoFactorOtp
      ) {
        setIsProfileModalOpen(false);
        setIsPasswordModalOpen(false);
        setIsTwoFactorModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [
    isChangingPassword,
    isProfileModalOpen,
    isSavingProfile,
    isSubmittingTwoFactor,
    isPasswordModalOpen,
    isSendingTwoFactorOtp,
    isTwoFactorModalOpen,
  ]);

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      const nextProfile = await updateProfileAvatar(file);
      setProfile(nextProfile);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật avatar, vui lòng thử lại.',
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const openProfileModal = () => {
    if (!profile) return;
    setProfileForm({
      name: profile.displayName,
    });
    setProfileError('');
    setProfileSuccess('');
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    if (isSavingProfile) return;
    setIsProfileModalOpen(false);
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const name = profileForm.name.trim();
    if (!name) {
      setProfileError('Vui lòng nhập tên hiển thị.');
      return;
    }

    if (name.length > 80) {
      setProfileError('Tên hiển thị tối đa 80 ký tự.');
      return;
    }

    try {
      setIsSavingProfile(true);
      const nextProfile = await updateProfileInfo({ name });
      setProfile(nextProfile);
      setProfileForm({ name: nextProfile.displayName });
      setProfileSuccess('Đã cập nhật thông tin người dùng.');
      window.setTimeout(() => {
        setIsProfileModalOpen(false);
      }, 700);
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật thông tin, vui lòng thử lại.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updatePasswordField =
    (field: keyof PasswordForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
      setPasswordError('');
      setPasswordSuccess('');
    };

  const openPasswordModal = () => {
    if (
      !profile ||
      profile.authProvider === 'GOOGLE' ||
      !profile.passwordAuthEnabled
    ) {
      return;
    }

    setPasswordError('');
    setPasswordSuccess('');
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (isChangingPassword) return;
    setIsPasswordModalOpen(false);
  };

  const openTwoFactorModal = async (mode: TwoFactorMode) => {
    if (!profile) return;
    if (mode === 'enable' && profile.twoFactorEnabled) return;
    if (mode === 'disable' && !profile.twoFactorEnabled) return;

    setTwoFactorMode(mode);
    setIsTwoFactorModalOpen(true);
    setTwoFactorOtp('');
    setTwoFactorError('');
    setTwoFactorSuccess('');
    setIsSendingTwoFactorOtp(true);

    try {
      if (mode === 'enable') {
        await sendTwoFactorSetupOtp();
      } else {
        await sendTwoFactorDisableOtp();
      }
      setTwoFactorSuccess('Đã gửi OTP tới email của bạn.');
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : 'Không thể gửi OTP, vui lòng thử lại.',
      );
    } finally {
      setIsSendingTwoFactorOtp(false);
    }
  };

  const closeTwoFactorModal = () => {
    if (isSubmittingTwoFactor || isSendingTwoFactorOtp) return;
    setIsTwoFactorModalOpen(false);
  };

  const handleTwoFactorSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setTwoFactorError('');

    if (twoFactorOtp.length !== 4) {
      setTwoFactorError('Vui lòng nhập đủ 4 số OTP.');
      return;
    }

    try {
      setIsSubmittingTwoFactor(true);
      const nextProfile =
        twoFactorMode === 'enable'
          ? await enableTwoFactor(twoFactorOtp)
          : await disableTwoFactor(twoFactorOtp);
      setProfile(nextProfile);
      setTwoFactorSuccess(
        twoFactorMode === 'enable'
          ? 'Đã bật xác thực 2 yếu tố.'
          : 'Đã tắt xác thực 2 yếu tố.',
      );
      setTwoFactorOtp('');
      window.setTimeout(() => {
        setIsTwoFactorModalOpen(false);
      }, 700);
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : 'Cập nhật xác thực 2 yếu tố thất bại, vui lòng thử lại.',
      );
    } finally {
      setIsSubmittingTwoFactor(false);
    }
  };

  const handleChangePasswordSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await changeProfilePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordSuccess('Đổi mật khẩu thành công.');
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Đổi mật khẩu thất bại, vui lòng thử lại.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!isHydrated || !profile) {
    return <section className="h-full w-full bg-[#f3f4f6]" />;
  }

  const isPasswordChangeDisabled =
    profile.authProvider === 'GOOGLE' || !profile.passwordAuthEnabled;
  const passwordDisabledTooltip =
    'Đổi mật khẩu không khả dụng vì bạn đang dùng tài khoản Google.';

  return (
    <section className="flex h-full w-full flex-col overflow-y-auto bg-[#f3f4f6]">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e1e2e4] bg-[#f8f9fb]/95 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileRailOpen(true)}
              className="rounded-full p-2 text-zinc-700 hover:bg-slate-100 md:hidden"
              aria-label="Mở thanh điều hướng"
            >
              <TextAlignJustify className="h-5 w-5" />
            </button>
            <h1 className="font-heading text-lg font-bold tracking-tight text-[#191c1e] lg:text-xl">Cài đặt & Cá nhân</h1>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)] sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-[#0052cc] to-[#3d83ff] text-2xl font-black text-white shadow-lg">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={`Avatar của ${profile.displayName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      profile.initials
                    )}
                    <span className="absolute bottom-1 right-1">
                      <StatusDot status={profile.status} />
                    </span>
                  </div>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleAvatarSelect(event);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d8dce2] bg-white px-3 py-1.5 text-xs font-semibold text-[#2c3342] hover:bg-[#f6f7f9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {isUploadingAvatar ? 'Đang tải ảnh...' : 'Đổi avatar'}
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-black tracking-tight text-[#191c1e]">{profile.displayName}</h2>
                      <p className="mt-1 text-sm font-medium text-[#727687]">{profile.email}</p>
                    </div>

                    <button
                      type="button"
                      onClick={openProfileModal}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#d8dce2] bg-white px-4 text-sm font-bold text-[#2c3342] hover:bg-[#f6f7f9]"
                    >
                      <Pencil className="h-4 w-4" />
                      Chỉnh sửa
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-[#dae2ff] px-3 py-1.5 text-xs font-semibold text-[#0040a2]">
                      Vai trò: {profile.roleLabel == "CUSTOMER" ? "Người dùng" : "Admin"}
                    </span>
                    <span className="rounded-lg bg-[#ffdbcf] px-3 py-1.5 text-xs font-semibold text-[#812800]">
                      Trạng thái: {profile.statusLabel}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-xl bg-linear-to-br from-[#425c9f] to-[#0052cc] p-6 text-white shadow-lg sm:p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Cloud Storage</h3>
              <p className="mt-2 text-3xl font-black">{profile.storageUsedPercent}%</p>
              <p className="mt-1 text-sm text-white/85">Dung lượng đang sử dụng</p>

              <div className="mt-5 h-2 w-full rounded-full bg-white/25">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${profile.storageUsedPercent}%` }}
                />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/85">
                Hãy kiểm tra và dọn dẹp media thường xuyên
              </p>
            </article>
          </section>

          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)]">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                  <Shield className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#191c1e]">Bảo mật tài khoản</h3>
              </div>
              <div className="space-y-3">
                <span
                  className="group relative block"
                  title={isPasswordChangeDisabled ? passwordDisabledTooltip : undefined}
                >
                  <button
                    type="button"
                    onClick={openPasswordModal}
                    disabled={isPasswordChangeDisabled}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0052cc] px-4 text-sm font-bold text-white hover:bg-[#0044aa] disabled:cursor-not-allowed disabled:bg-[#c7d0df] disabled:text-[#5f6878]"
                  >
                    <KeyRound className="h-4 w-4" />
                    Đổi mật khẩu
                  </button>
                  {isPasswordChangeDisabled ? (
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-60 -translate-x-1/2 rounded-lg bg-[#191c1e] px-3 py-2 text-center text-xs font-semibold leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {passwordDisabledTooltip}
                    </span>
                  ) : null}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    void openTwoFactorModal(
                      profile.twoFactorEnabled ? 'disable' : 'enable',
                    );
                  }}
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold ${
                    profile.twoFactorEnabled
                      ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                      : 'border-[#d8dce2] bg-white text-[#2c3342] hover:bg-[#f6f7f9]'
                  }`}
                >
                  <ShieldCheck
                    className={`h-4 w-4 ${
                      profile.twoFactorEnabled
                        ? 'text-red-600'
                        : 'text-[#0052cc]'
                    }`}
                  />
                  {profile.twoFactorEnabled
                    ? 'Tắt xác thực 2 yếu tố'
                    : 'Bật xác thực 2 yếu tố'}
                </button>
              </div>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)]">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                  <Lock className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#191c1e]">Quyền riêng tư</h3>
              </div>
              <ul className="space-y-3 text-sm text-[#424655]">
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Hiển thị trạng thái: Mọi người</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Đã chặn: 0 tài khoản</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Biên nhận đã xem: Bật</li>
              </ul>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(25,28,30,0.06)] md:col-span-2 xl:col-span-1">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                  <Bell className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#191c1e]">Thông báo</h3>
              </div>
              <ul className="space-y-3 text-sm text-[#424655]">
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Tin nhắn mới</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Lời mời kết bạn</li>
                <li className="rounded-lg bg-[#f3f4f6] px-3 py-2">Cập nhật bảo mật</li>
              </ul>
            </article>
          </section>
        </div>

        {isProfileModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <button
              type="button"
              aria-label="Đóng chỉnh sửa thông tin"
              className="absolute inset-0 h-full w-full"
              onClick={closeProfileModal}
            />

            <div
              ref={profileDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-profile-title"
              tabIndex={-1}
              className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)] outline-none"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                    <Pencil className="h-5 w-5" />
                  </span>
                  <h2 id="edit-profile-title" className="text-lg font-bold text-[#191c1e]">
                    Chỉnh sửa thông tin
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeProfileModal}
                  disabled={isSavingProfile}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#727687] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleProfileSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="displayName" className="text-sm font-semibold text-[#424655]">
                    Tên hiển thị
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={80}
                    value={profileForm.name}
                    onChange={(event) => {
                      setProfileForm({ name: event.target.value });
                      setProfileError('');
                      setProfileSuccess('');
                    }}
                    className="h-10 w-full rounded-lg border border-[#d8dce2] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#dae2ff]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profileEmail" className="text-sm font-semibold text-[#424655]">
                    Email
                  </label>
                  <input
                    id="profileEmail"
                    type="email"
                    value={profile.email}
                    readOnly
                    className="h-10 w-full cursor-not-allowed rounded-lg border border-[#d8dce2] bg-[#f3f4f6] px-3 text-sm text-[#727687] outline-none"
                  />
                </div>

                {profileError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {profileError}
                  </p>
                ) : null}

                {profileSuccess ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {profileSuccess}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0052cc] px-4 text-sm font-bold text-white hover:bg-[#0044aa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {isSavingProfile ? 'Đang cập nhật...' : 'Lưu thay đổi'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isPasswordModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <button
              type="button"
              aria-label="Đóng đổi mật khẩu"
              className="absolute inset-0 h-full w-full"
              onClick={closePasswordModal}
            />

            <div
              ref={passwordDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="change-password-title"
              tabIndex={-1}
              className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)] outline-none"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <h2 id="change-password-title" className="text-lg font-bold text-[#191c1e]">
                    Đổi mật khẩu
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={isChangingPassword}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#727687] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleChangePasswordSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="currentPassword" className="text-sm font-semibold text-[#424655]">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={updatePasswordField('currentPassword')}
                    className="h-10 w-full rounded-lg border border-[#d8dce2] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#dae2ff]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="newPassword" className="text-sm font-semibold text-[#424655]">
                    Mật khẩu mới
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={passwordForm.newPassword}
                    onChange={updatePasswordField('newPassword')}
                    className="h-10 w-full rounded-lg border border-[#d8dce2] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#dae2ff]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-sm font-semibold text-[#424655]">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={passwordForm.confirmPassword}
                    onChange={updatePasswordField('confirmPassword')}
                    className="h-10 w-full rounded-lg border border-[#d8dce2] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#dae2ff]"
                  />
                </div>

                {passwordError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {passwordError}
                  </p>
                ) : null}

                {passwordSuccess ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {passwordSuccess}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0052cc] px-4 text-sm font-bold text-white hover:bg-[#0044aa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  {isChangingPassword ? 'Đang đổi mật khẩu...' : 'Cập nhật mật khẩu'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isTwoFactorModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <button
              type="button"
              aria-label={`Đóng ${
                twoFactorMode === 'enable'
                  ? 'bật xác thực 2 yếu tố'
                  : 'tắt xác thực 2 yếu tố'
              }`}
              className="absolute inset-0 h-full w-full"
              onClick={closeTwoFactorModal}
            />

            <div
              ref={twoFactorDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="two-factor-title"
              tabIndex={-1}
              className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)] outline-none"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#dae2ff] text-[#0052cc]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <h2 id="two-factor-title" className="text-lg font-bold text-[#191c1e]">
                    {twoFactorMode === 'enable'
                      ? 'Bật xác thực 2 yếu tố'
                      : 'Tắt xác thực 2 yếu tố'}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeTwoFactorModal}
                  disabled={isSubmittingTwoFactor || isSendingTwoFactorOtp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#727687] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleTwoFactorSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="twoFactorOtp" className="text-sm font-semibold text-[#424655]">
                    Mã OTP email
                  </label>
                  <input
                    id="twoFactorOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    required
                    value={twoFactorOtp}
                    onChange={(event) => {
                      setTwoFactorOtp(
                        event.target.value.replace(/\D/g, '').slice(0, 4),
                      );
                      setTwoFactorError('');
                    }}
                    className="h-11 w-full rounded-lg border border-[#d8dce2] bg-white px-3 text-center text-lg font-bold tracking-[0.25em] text-[#191c1e] outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#dae2ff]"
                    placeholder="0000"
                  />
                </div>

                {isSendingTwoFactorOtp ? (
                  <p className="rounded-lg border border-[#d8dce2] bg-[#f3f4f6] px-3 py-2 text-sm text-[#424655]">
                    Đang gửi OTP tới email của bạn...
                  </p>
                ) : null}

                {twoFactorError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {twoFactorError}
                  </p>
                ) : null}

                {twoFactorSuccess ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {twoFactorSuccess}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmittingTwoFactor || isSendingTwoFactorOtp}
                  className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    twoFactorMode === 'enable'
                      ? 'bg-[#0052cc] hover:bg-[#0044aa]'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isSubmittingTwoFactor
                    ? twoFactorMode === 'enable'
                      ? 'Đang bật xác thực...'
                      : 'Đang tắt xác thực...'
                    : twoFactorMode === 'enable'
                      ? 'Xác nhận bật 2FA'
                      : 'Xác nhận tắt 2FA'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isMobileRailOpen ? (
          <>
            <button
              type="button"
              aria-label="Đóng thanh điều hướng"
              className="fixed inset-0 z-40 bg-slate-900/35 md:hidden"
              onClick={() => setIsMobileRailOpen(false)}
            />
            <ChatAppRail
              activeNav="profile"
              avatarUrl={profile.avatarUrl || undefined}
              initials={profile.initials || undefined}
              mobileOpen
              onRequestClose={() => setIsMobileRailOpen(false)}
            />
          </>
        ) : null}
    </section>
  );
}
