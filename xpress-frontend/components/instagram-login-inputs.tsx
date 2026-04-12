type InstagramLoginInputsProps = {
  accountInputId?: string;
  passwordInputId?: string;
  phone: string;
  password: string;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

export default function InstagramLoginInputs({
  accountInputId = "account",
  passwordInputId = "password",
  phone,
  password,
  onPhoneChange,
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
          name="phone"
          required
          type="tel"
          placeholder=" "
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          className="peer h-full w-full border-0 bg-transparent px-2 pt-[9px] pb-[7px] text-base text-[#262626] outline-none valid:pt-[14px] valid:pb-[2px] valid:text-xs"
        />
        <span className="pointer-events-none absolute left-2 origin-left text-xs text-[#737373] transition-transform duration-100 ease-out peer-placeholder-shown:translate-y-0 peer-valid:-translate-y-[10px] peer-valid:scale-[0.833333]">
          Phone number
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
          Password
        </span>
      </label>
    </div>
  );
}
