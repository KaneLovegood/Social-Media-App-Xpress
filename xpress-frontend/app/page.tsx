"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getValidAccessToken } from "@/lib/auth-client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getValidAccessToken().then((token) => {
      if (!token) {
        router.replace("/login");
      } else {
        router.replace("/chat/me");
      }
    });
  }, [router]);

  return <div className="min-h-screen flex items-center justify-center">Redirecting...</div>;
}
