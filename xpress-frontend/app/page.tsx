import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("xpress_access_token")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Đăng nhập thành công</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Phiên đăng nhập đã được lưu. Bạn có thể bắt đầu tích hợp các màn cần bảo vệ bằng access
          token hiện tại.
        </p>
        <div className="mt-6">
          <Link
            href="/chat"
            className="mr-3 inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800"
          >
            Open chat demo
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-md bg-[#f25019] px-4 text-sm font-medium text-white"
          >
            Quay lại trang login
          </Link>
        </div>
      </section>
    </main>
  );
}
