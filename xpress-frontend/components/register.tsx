import Image from "next/image";
import Link from "next/link";

export default function Register() {
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
            <p className="font-brand text-sm font-semibold text-[#f25019]">Xpress</p>
            <h1 className="mt-1 font-heading text-5xl font-bold leading-tight text-[#333333]">
              Đăng ký
            </h1>

            <form className="mt-8 space-y-4">
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
                  className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium text-[#333333]">
                  Số điện thoại
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="0901234567"
                  required
                  className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[#333333]"
                >
                  Mật khẩu
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Pass1234"
                  required
                  className="h-10 w-full rounded-md border border-transparent bg-white px-4 text-sm text-[#333333] outline-none ring-orange-300 placeholder:text-[#bfbfbf] focus:ring-2"
                />
              </div>

              <button
                type="submit"
                className="mt-2 h-9 w-full rounded bg-[#f25019] text-sm font-semibold text-white transition hover:bg-[#df4614]"
              >
                Tạo tài khoản
              </button>
            </form>

            <p className="mt-9 text-center text-sm text-[#333333]">
              Đã có tài khoản?{" "}
              <Link href="/login" className="font-semibold text-[#ae4700]">
                Đăng nhập ngay
              </Link>
            </p>
          </div>

          <div className="relative hidden min-h-[480px] items-center justify-center lg:flex">
            <Image
              src="/assets/—Pngtree—delivery person riding orange motor_23243503.png"
              alt="Shipper giao hàng"
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
