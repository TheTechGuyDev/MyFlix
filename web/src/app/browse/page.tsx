"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/landing/Logo";
import { getAccount, getActiveProfileId, signOut } from "@/lib/mock-auth";

export default function BrowsePage() {
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/login");
    const p = acc.profiles.find((x) => x.id === getActiveProfileId());
    if (!p) return router.replace("/profiles");
    setName(p.name);
  }, [router]);

  return (
    <div className="min-h-screen bg-ink px-4 py-5 sm:px-10">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex gap-4 text-sm">
          <Link href="/profiles" className="hover:underline">Switch Profile</Link>
          <button onClick={() => { signOut(); router.push("/"); }} className="hover:underline">Sign Out</button>
        </div>
      </header>
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold">Welcome, {name}</h1>
        <p className="mt-3 text-muted">The MyFlix home screen is coming in the next step.</p>
      </div>
    </div>
  );
}
