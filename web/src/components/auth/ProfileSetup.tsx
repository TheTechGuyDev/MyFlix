"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccount, MAX_PROFILES, newId, saveProfiles, type Profile } from "@/lib/mock-auth";
import Avatar from "./Avatar";
import { PrimaryButton } from "./ui";
import { StepLabel } from "./SignupShell";

type Row = { name: string; kids: boolean };

export default function ProfileSetup() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(Array.from({ length: MAX_PROFILES }, () => ({ name: "", kids: false })));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/signup");
    if (!acc.payment) return router.replace("/signup/payment");
    if (acc.profiles.length) {
      setRows((r) => r.map((row, i) => (acc.profiles[i] ? { name: acc.profiles[i].name, kids: acc.profiles[i].kids } : row)));
    }
  }, [router]);

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const onNext = async () => {
    const filled = rows.filter((r) => r.name.trim());
    if (!rows[0].name.trim()) return setError("Please enter your name to create your profile.");
    const names = filled.map((r) => r.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return setError("Each profile needs a different name.");
    setError("");
    setLoading(true);
    const profiles: Profile[] = filled.map((r, i) => ({ id: newId(), name: r.name.trim().slice(0, 20), kids: r.kids, avatar: i }));
    const res = await saveProfiles(profiles);
    setLoading(false);
    if (res.ok) router.push("/profiles");
  };

  return (
    <div className="space-y-4">
      <StepLabel step={4} />
      <h1 className="text-3xl font-bold leading-tight">Who will be watching MyFlix?</h1>
      <p className="text-lg">
        People who live with you can each have a profile with their own recommendations, My List and settings. Add up to {MAX_PROFILES}.
      </p>

      <div className="space-y-3 pt-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <Avatar index={i} className="h-14 w-14 shrink-0" kids={r.kids} />
            <div className="flex-1">
              <input
                value={r.name}
                maxLength={20}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder={i === 0 ? "Your name" : "Add profile"}
                aria-label={i === 0 ? "Your name" : `Profile ${i + 1} name`}
                className="h-12 w-full rounded border border-neutral-400 px-3 text-base outline-none focus:ring-2 focus:ring-neutral-900"
              />
              {i > 0 && (
                <label className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
                  <input type="checkbox" checked={r.kids} onChange={(e) => set(i, { kids: e.target.checked })} className="accent-brand" />
                  Kids profile
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <PrimaryButton onClick={onNext} loading={loading}>Next</PrimaryButton>
    </div>
  );
}
