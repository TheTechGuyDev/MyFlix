"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccount, nextStep } from "@/lib/account";
import { refreshAccount } from "@/lib/store";
import { sb } from "@/lib/supabase";

const TYPES: EmailOtpType[] = ["signup", "magiclink", "recovery", "email_change", "email", "invite"];

/** Opened from links in MyFlix emails: confirms the email, sign-in or reset, then moves on. */
export default function ConfirmLink() {
  const params = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    const hash = params.get("token_hash") ?? "";
    const type = params.get("type") as EmailOtpType;
    if (!hash || !TYPES.includes(type)) return setErr("This link isn't complete. Copy the whole link from the email, or use the code instead.");
    (async () => {
      let { error } = await sb().auth.verifyOtp({ token_hash: hash, type });
      if (error && hash.startsWith("pkce_")) ({ error } = await sb().auth.verifyOtp({ token_hash: hash.slice(5), type }));
      if (error) return setErr("This link has expired or was already used. Links work for 1 hour.");
      await refreshAccount();
      if (type === "recovery") return router.replace("/login/reset");
      if (type === "email_change") return router.replace("/account");
      router.replace(nextStep(getAccount()));
    })();
  }, [params, router]);

  return (
    <div className="w-full bg-black/75 px-5 py-10 sm:max-w-md sm:rounded-lg sm:px-12 sm:py-12">
      {err ? (
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Link not valid</h1>
          <p className="text-muted">{err}</p>
          <Link href="/login" className="inline-block rounded bg-brand px-5 py-3 font-semibold hover:bg-brand-hover">Go to sign in</Link>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-lg">Confirming…</p>
        </div>
      )}
    </div>
  );
}
