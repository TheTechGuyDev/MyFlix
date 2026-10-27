import { reasons, type Reason } from "@/lib/landing-data";

function Icon({ name }: { name: Reason["icon"] }) {
  const common = { viewBox: "0 0 48 48", className: "h-14 w-14", fill: "none", stroke: "url(#rg)", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const defs = (
    <defs>
      <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#19c37d" />
        <stop offset="1" stopColor="#f5c542" />
      </linearGradient>
    </defs>
  );
  switch (name) {
    case "tv":
      return (<svg {...common}>{defs}<rect x="5" y="9" width="38" height="25" rx="3" /><path d="M17 41h14M24 34v7" /><path d="m21 17 8 4.5-8 4.5z" /></svg>);
    case "download":
      return (<svg {...common}>{defs}<path d="M24 7v22M15 21l9 9 9-9" /><path d="M8 33v5a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3v-5" /></svg>);
    case "data":
      return (<svg {...common}>{defs}<path d="M8 38a20 20 0 0 1 32 0" /><path d="M14 33a12 12 0 0 1 20 0" /><circle cx="24" cy="36" r="3" /><path d="M24 20V9" /></svg>);
    case "kids":
      return (<svg {...common}>{defs}<circle cx="24" cy="24" r="17" /><circle cx="18" cy="21" r="1.5" /><circle cx="30" cy="21" r="1.5" /><path d="M17 29c3.5 4 10.5 4 14 0" /></svg>);
  }
}

export default function Reasons() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12">
      <h2 className="mb-4 text-xl font-bold sm:text-2xl">More Reasons to Join</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {reasons.map((r) => (
          <article
            key={r.title}
            className="relative flex min-h-[220px] flex-col rounded-2xl bg-gradient-to-br from-[#122a20] via-ink-2 to-[#161b2e] p-5 pb-20"
          >
            <h3 className="text-xl font-bold leading-snug sm:text-2xl">{r.title}</h3>
            <p className="mt-3 text-base text-muted">{r.body}</p>
            <div className="absolute bottom-4 right-4">
              <Icon name={r.icon} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
