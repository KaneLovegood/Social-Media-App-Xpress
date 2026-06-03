type AuthHeadingProps = {
  title: string;
  subtitle: string;
};

export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <header className="mb-8 text-center text-white">
      <h1 className="font-heading text-[40px] font-bold leading-tight">{title}</h1>
      <p className="mt-2 text-[18px] font-bold leading-snug">{subtitle}</p>
    </header>
  );
}
