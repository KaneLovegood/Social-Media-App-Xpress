type InstagramLoginInputsProps = {
  accountInputId?: string;
  passwordInputId?: string;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

export default function InstagramLoginInputs({
  accountInputId = "account",
  passwordInputId = "password",
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: InstagramLoginInputsProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="relative flex h-[38px] w-full items-center rounded-[3px] border border-[rgb(219,219,219)] bg-[rgb(250,250,250)]"
        htmlFor={accountInputId}
      >
        <input
          id={accountInputId}
          name="email"
          required
          type="email"
          placeholder=" "
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="peer h-full w-full border-0 bg-transparent px-2 pt-[9px] pb-[7px] text-base text-[#262626] outline-none valid:pt-[14px] valid:pb-[2px] valid:text-xs"
        />
        <span className="pointer-events-none absolute left-2 origin-left text-xs text-[#737373] transition-transform duration-100 ease-out peer-placeholder-shown:translate-y-0 peer-valid:-translate-y-[10px] peer-valid:scale-[0.833333]">
          Email
        </span>
      </label>

      <label
        className="relative flex h-[38px] w-full items-center rounded-[3px] border border-[rgb(219,219,219)] bg-[rgb(250,250,250)]"
        htmlFor={passwordInputId}
      >
        <input
          id={passwordInputId}
          name="password"
          required
          type="password"
          placeholder=" "
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="peer h-full w-full border-0 bg-transparent px-2 pt-[9px] pb-[7px] text-base text-[#262626] outline-none valid:pt-[14px] valid:pb-[2px] valid:text-xs"
        />
        <span className="pointer-events-none absolute left-2 origin-left text-xs text-[#737373] transition-transform duration-100 ease-out peer-placeholder-shown:translate-y-0 peer-valid:-translate-y-[10px] peer-valid:scale-[0.833333]">
          Mật khẩu
        </span>
      </label>
    </div>
  );
}
