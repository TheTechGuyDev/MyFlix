"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={cx("glass rounded-2xl", pad && "p-5", className)}>{children}</div>;
}

export function CardTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" | "soft"; size?: "sm" | "md"; icon?: ReactNode };
export function Button({ variant = "primary", size = "md", icon, className = "", children, ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand-hover shadow-sm shadow-brand/30",
    ghost: "hover:bg-slate-900/5 dark:hover:bg-white/10",
    outline: "border border-slate-300/80 bg-white/50 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10",
    danger: "bg-danger text-white hover:opacity-90",
    soft: "bg-brand/10 text-brand hover:bg-brand/15 dark:text-brand-bright",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        v,
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-slate-300/80 bg-white/70 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-white/5";

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "pr-8", props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "h-auto min-h-24 py-2", props.className)} />;
}

export function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label?: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      {label && (
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-brand" : "bg-slate-300 dark:bg-white/15")}
      >
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

const tones = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  bad: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  muted: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  brand: "bg-brand/15 text-brand dark:text-brand-bright",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};
export type Tone = keyof typeof tones;
export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

export const statusTone = (s: string): Tone =>
  ({ published: "ok", active: "ok", success: "ok", sent: "ok", resolved: "ok", draft: "muted", scheduled: "info", trial: "info", pending: "warn", past_due: "warn", open: "warn", archived: "muted", cancelled: "muted", refunded: "violet", failed: "bad", suspended: "bad", urgent: "bad", high: "warn", normal: "muted", low: "muted" } as Record<string, Tone>)[s] ?? "muted";

export function Stat({ label, value, delta, icon, hint }: { label: string; value: string; delta?: number; icon?: ReactNode; hint?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {delta !== undefined && (
            <p className={cx("mt-1 text-xs font-semibold", delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% <span className="font-normal text-slate-500">vs last 30 days</span>
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className="rounded-xl bg-brand/10 p-2.5 text-brand dark:text-brand-bright">{icon}</div>}
      </div>
    </Card>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={cx("glass flex max-h-[90vh] w-full flex-col rounded-2xl !bg-white/90 dark:!bg-[#0e1513]/95", wide ? "max-w-3xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-slate-900/5 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="thin-scroll overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-3 dark:border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <aside className="glass thin-scroll absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto rounded-l-2xl !bg-white/95 dark:!bg-[#0e1513]/95" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-inherit px-5 py-4 backdrop-blur dark:border-white/10">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-slate-900/5 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-900/5 p-1 dark:bg-white/5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition", value === t.id ? "bg-white shadow-sm dark:bg-white/15" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <p className="font-semibold">{title}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "warn" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
      <div className={cx("h-full rounded-full transition-all", tone === "brand" ? "bg-brand" : "bg-warn")} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Table({ head, children, minW = 720 }: { head: ReactNode[]; children: ReactNode; minW?: number }) {
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: minW }}>
        <thead>
          <tr className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={cx("px-3 py-3 align-middle", className)}>{children}</td>;

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext<(msg: string, tone?: "ok" | "bad") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: "ok" | "bad" }[]>([]);
  const push = useCallback((msg: string, tone: "ok" | "bad" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={cx("rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl", t.tone === "ok" ? "bg-slate-900 dark:bg-brand" : "bg-danger")}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Avatar({ name, index = 0, size = 32 }: { name: string; index?: number; size?: number }) {
  const colors = ["from-emerald-400 to-emerald-700", "from-sky-400 to-blue-700", "from-amber-300 to-orange-600", "from-rose-400 to-red-700", "from-violet-400 to-purple-700"];
  const initials = name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white", colors[index % colors.length])} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function Confirm({ open, title, body, onCancel, onConfirm, danger, label = "Confirm" }: { open: boolean; title: string; body: string; onCancel: () => void; onConfirm: () => void; danger?: boolean; label?: string }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{label}</Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{body}</p>
    </Modal>
  );
}
