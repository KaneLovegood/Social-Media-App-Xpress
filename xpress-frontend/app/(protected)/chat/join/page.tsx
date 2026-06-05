"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  extractGroupInviteCode,
  joinGroupByInviteWithTimeout,
} from "@/lib/chat-groups";

export default function JoinGroupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteCode = extractGroupInviteCode(
    searchParams.get("code") ?? searchParams.get("inviteCode") ?? "",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!inviteCode) {
      setError("Link moi nhom khong hop le.");
      return () => {
        cancelled = true;
      };
    }

    void joinGroupByInviteWithTimeout(inviteCode)
      .then((details) => {
        if (cancelled) return;
        router.replace(`/chat/me?roomId=${encodeURIComponent(details.roomId)}`);
      })
      .catch((joinError) => {
        if (cancelled) return;
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Khong the tham gia nhom bang link nay.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [inviteCode, router]);

  return (
    <section className="flex h-full w-full items-center justify-center bg-[#f8f9fb] px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-base font-semibold text-slate-900">
              Khong the tham gia nhom
            </h1>
            <p className="mt-2 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => router.replace("/chat/me")}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Quay lai chat
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-600" />
            <h1 className="mt-3 text-base font-semibold text-slate-900">
              Dang tham gia nhom...
            </h1>
          </>
        )}
      </div>
    </section>
  );
}
