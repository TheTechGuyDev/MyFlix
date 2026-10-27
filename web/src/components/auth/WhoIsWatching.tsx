"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/landing/Logo";
import { getAccount, MAX_PROFILES, newId, nextStep, saveProfiles, setActiveProfile, type Profile } from "@/lib/mock-auth";
import Avatar, { avatarColors } from "./Avatar";
import { useT } from "@/lib/i18n";

export default function WhoIsWatching() {
  const tx = useT();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ready, setReady] = useState(false);
  const [manage, setManage] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [locked, setLocked] = useState<Profile | null>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) return router.replace("/login");
    const step = nextStep(acc);
    if (step !== "/profiles") return router.replace(step);
    setProfiles(acc.profiles);
    setReady(true);
  }, [router]);

  const persist = async (next: Profile[]) => {
    setProfiles(next);
    await saveProfiles(next);
  };

  const pick = (p: Profile) => {
    if (manage) return setEditing(p);
    if (p.settings?.pin) return setLocked(p);
    setActiveProfile(p.id);
    router.push("/browse");
  };

  if (!ready) return <div className="min-h-screen bg-ink" />;

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <header className="px-4 py-5 sm:px-10">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        <h1 className="text-3xl font-medium sm:text-5xl">{tx(manage ? "Manage Profiles" : "Who's watching?")}</h1>
        <ul className="mt-8 flex flex-wrap justify-center gap-5 sm:gap-8">
          {profiles.map((p) => (
            <li key={p.id}>
              <button onClick={() => pick(p)} className="group flex w-24 flex-col items-center gap-3 outline-none sm:w-36">
                <span className="relative block rounded-md ring-white transition group-hover:ring-4 group-focus-visible:ring-4">
                  <Avatar index={p.avatar} kids={p.kids} className={`h-24 w-24 sm:h-36 sm:w-36 ${manage ? "opacity-50" : ""}`} />
                  {manage && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="h-10 w-10 rounded-full border-2 border-white p-2" fill="none" stroke="white" strokeWidth="2"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
                    </span>
                  )}
                </span>
                <span className="truncate text-base text-muted group-hover:text-white sm:text-xl">{p.name}</span>
              </button>
            </li>
          ))}
          {profiles.length < MAX_PROFILES && (
            <li>
              <button
                onClick={() => setEditing({ id: "", name: "", kids: false, avatar: profiles.length % avatarColors.length })}
                className="group flex w-24 flex-col items-center gap-3 sm:w-36"
              >
                <span className="flex h-24 w-24 items-center justify-center rounded-md text-muted transition group-hover:bg-white group-hover:text-ink sm:h-36 sm:w-36">
                  <svg viewBox="0 0 24 24" className="h-16 w-16" fill="currentColor"><circle cx="12" cy="12" r="11" fillOpacity=".2" /><path d="M11 6h2v5h5v2h-5v5h-2v-5H6v-2h5z" /></svg>
                </span>
                <span className="text-base text-muted group-hover:text-white sm:text-xl">{tx("Add Profile")}</span>
              </button>
            </li>
          )}
        </ul>
        <button
          onClick={() => setManage((m) => !m)}
          className={`mt-12 border px-6 py-2 text-lg tracking-widest transition ${
            manage ? "border-white bg-white font-semibold text-ink hover:bg-brand hover:text-white hover:border-brand" : "border-muted text-muted hover:border-white hover:text-white"
          }`}
        >
          {manage ? "DONE" : "MANAGE PROFILES"}
        </button>
      </main>

      {locked && (
        <PinPrompt
          profile={locked}
          onCancel={() => setLocked(null)}
          onOk={() => {
            setActiveProfile(locked.id);
            router.push("/browse");
          }}
        />
      )}

      {editing && (
        <ProfileEditor
          profile={editing}
          canDelete={!!editing.id && profiles.length > 1}
          taken={profiles.filter((p) => p.id !== editing.id).map((p) => p.name.toLowerCase())}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            await persist(p.id ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, { ...p, id: newId() }]);
            setEditing(null);
          }}
          onDelete={async () => {
            await persist(profiles.filter((x) => x.id !== editing.id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PinPrompt({ profile, onOk, onCancel }: { profile: Profile; onOk: () => void; onCancel: () => void }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    refs[0].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = digits.map((x, j) => (j === i ? d : x));
    setDigits(next);
    setError(false);
    if (d && i < 3) refs[i + 1].current?.focus();
    if (next.every(Boolean)) {
      if (next.join("") === profile.settings?.pin) onOk();
      else {
        setError(true);
        setDigits(["", "", "", ""]);
        refs[0].current?.focus();
      }
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-4 text-center">
      <button onClick={onCancel} aria-label="Close" className="absolute right-6 top-6 text-white/70 hover:text-white">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <p className="text-white/70">Profile Lock is on.</p>
      <h2 className="mt-2 text-2xl font-medium sm:text-4xl">Enter your PIN to access {profile.name}.</h2>
      <div className="mt-8 flex gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            value={d}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs[i - 1].current?.focus()}
            inputMode="numeric"
            type="password"
            aria-label={`PIN digit ${i + 1}`}
            className={`h-16 w-14 rounded border-2 bg-transparent text-center text-3xl outline-none focus:scale-110 focus:border-white sm:h-20 sm:w-16 ${error ? "border-danger" : "border-white/50"}`}
          />
        ))}
      </div>
      {error && <p className="mt-4 text-danger">Whoops, wrong PIN. Please try again.</p>}
      <p className="mt-8 text-sm text-white/60">Forgot PIN? Change it from Account → Profiles.</p>
    </div>
  );
}

function ProfileEditor({
  profile,
  canDelete,
  taken,
  onClose,
  onSave,
  onDelete,
}: {
  profile: Profile;
  canDelete: boolean;
  taken: string[];
  onClose: () => void;
  onSave: (p: Profile) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [kids, setKids] = useState(profile.kids);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState("");

  const save = () => {
    const n = name.trim();
    if (!n) return setError("Please enter a name.");
    if (taken.includes(n.toLowerCase())) return setError("Another profile already uses this name.");
    onSave({ ...profile, name: n.slice(0, 20), kids, avatar });
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-ink-2 p-6 text-left sm:p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold sm:text-3xl">{profile.id ? "Edit Profile" : "Add Profile"}</h2>
        <div className="mt-6 flex gap-5">
          <Avatar index={avatar} kids={kids} className="h-24 w-24 shrink-0" />
          <div className="flex-1 space-y-4">
            <input
              autoFocus
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="h-11 w-full rounded bg-ink-3 px-3 text-white outline-none focus:ring-2 focus:ring-white"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} className="h-4 w-4 accent-brand" />
              Kids profile (shows only titles rated for 12 and under)
            </label>
          </div>
        </div>
        <p className="mt-6 text-sm text-muted">Choose an icon</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {avatarColors.map((_, i) => (
            <button
              key={i}
              onClick={() => setAvatar(i)}
              aria-label={`Icon ${i + 1}`}
              className={`rounded-md ring-offset-2 ring-offset-ink-2 ${avatar === i ? "ring-2 ring-white" : ""}`}
            >
              <Avatar index={i} className="h-10 w-10" />
            </button>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={save} className="rounded bg-white px-6 py-2 font-semibold text-ink hover:bg-brand hover:text-white">
            Save
          </button>
          <button onClick={onClose} className="rounded border border-muted px-6 py-2 text-muted hover:border-white hover:text-white">
            Cancel
          </button>
          {canDelete && (
            <button onClick={onDelete} className="ml-auto rounded border border-danger/70 px-6 py-2 text-danger hover:bg-danger hover:text-white">
              Delete Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
