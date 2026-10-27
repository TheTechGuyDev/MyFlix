"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> & {
  label: string;
  error?: string;
  tone?: "light" | "dark";
  revealable?: boolean;
};

export function Field({ label, error, tone = "light", revealable, type = "text", className = "", ...rest }: FieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  const dark = tone === "dark";
  const inputType = revealable ? (show ? "text" : "password") : type;

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          placeholder=" "
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`peer h-14 w-full rounded border px-4 pt-4 text-base outline-none transition focus:ring-2 ${
            revealable ? "pr-16" : ""
          } ${
            dark
              ? "border-white/40 bg-black/50 text-white focus:ring-white"
              : "border-neutral-400 bg-white text-neutral-900 focus:ring-neutral-900"
          } ${error ? "!border-danger" : ""}`}
          {...rest}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-4 top-1.5 text-xs transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs ${
            dark ? "text-muted" : "text-neutral-500"
          }`}
        >
          {label}
        </label>
        {revealable && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${dark ? "text-muted hover:text-white" : "text-neutral-500 hover:text-neutral-900"}`}
          >
            {show ? "HIDE" : "SHOW"}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm0-4h-2V7h2z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PrimaryButton({
  children,
  loading,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; children: ReactNode }) {
  return (
    <button
      disabled={loading || rest.disabled}
      className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded bg-brand text-xl font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="h-6 w-6" /> : children}
    </button>
  );
}

export function Alert({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <div
      role="alert"
      className={`rounded px-4 py-3 text-sm ${tone === "dark" ? "bg-[#e87c03] text-white" : "bg-amber-100 text-amber-900"}`}
    >
      {children}
    </div>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(v: string) {
  if (!v.trim()) return "Email is required.";
  if (!EMAIL_RE.test(v.trim())) return "Please enter a valid email address.";
  return "";
}

export function validatePassword(v: string) {
  if (!v) return "Password is required.";
  if (v.length < 6) return "Your password must contain at least 6 characters.";
  if (v.length > 60) return "Your password must contain no more than 60 characters.";
  return "";
}
