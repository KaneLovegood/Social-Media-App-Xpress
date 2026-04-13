import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("xpress_access_token")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  redirect("/chat/me");
}
