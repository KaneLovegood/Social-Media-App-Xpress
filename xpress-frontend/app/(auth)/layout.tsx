import type { ReactNode } from "react";
import Image from "next/image";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-10"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255, 209, 176, 0.78), rgba(255, 209, 176, 0.78)), url('/assets/Restaurant-Online-Food-Delivery-1.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <section className="relative w-full max-w-6xl rounded-3xl border border-white/30 bg-[#f8d7c2]/80 p-4 shadow-2xl backdrop-blur-sm sm:p-8 lg:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[440px_1fr]">
          <div className="rounded-3xl border border-white/30 bg-white/40 p-6 shadow-xl backdrop-blur-md sm:p-8">
            {children}
          </div>

          <div className="relative hidden min-h-[480px] items-center justify-center lg:flex">
            <Image
              src="/assets/—Pngtree—delivery person riding orange motor_23243503.png"
              alt="Delivery rider"
              width={640}
              height={640}
              priority
              className="h-auto w-full max-w-[560px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
