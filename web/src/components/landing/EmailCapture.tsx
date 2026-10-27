"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function EmailCapture() {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const validate = (value: string) => {
    if (!value.trim()) return "Email is required.";
    if (!EMAIL_RE.test(value.trim())) return "Please enter a valid email address.";
    return "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = validate(email);
    setTouched(true);
    setError(msg);
    if (msg) return;
    router.push(`/signup?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <p className="mb-4 text-base text-white sm:text-lg">
        Ready to watch? Enter your email to create or restart your membership.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center">
        <div className="w-full sm:max-w-md">
          <div className="relative">
            <input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched) setError(validate(e.target.value));
              }}
              onBlur={() => {
                setTouched(true);
                setError(validate(email));
              }}
              placeholder=" "
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-err` : undefined}
              className={`peer h-14 w-full rounded border bg-black/60 px-4 pt-4 text-base text-white outline-none backdrop-blur-sm transition focus:ring-2 focus:ring-white ${
                error ? "border-danger" : "border-white/40"
              }`}
            />
            <label
              htmlFor={id}
              className="pointer-events-none absolute left-4 top-1.5 text-xs text-muted transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs"
            >
              Email address
            </label>
          </div>
          {error && (
            <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1.5 text-left text-sm text-danger">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm0-4h-2V7h2z" />
              </svg>
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded bg-brand px-6 text-lg font-semibold text-white transition hover:bg-brand-hover sm:h-14 sm:px-7 sm:text-2xl"
        >
          Get Started
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
