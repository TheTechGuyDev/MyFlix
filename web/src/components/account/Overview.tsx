"use client";

import Link from "next/link";
import Avatar from "@/components/auth/Avatar";
import { getPlan, naira } from "@/lib/plans";
import { devicesOf } from "@/lib/mock-auth";
import { Card, LinkRow, PageTitle, fmtDate, useAccountCtx } from "./AccountShell";

export const methodLabel = (m?: string, last4?: string) =>
  m === "card" ? `Card ending in ${last4 ?? "••••"}` : m === "transfer" ? "Bank transfer" : m === "ussd" ? "USSD" : "None";

export default function Overview() {
  const { account } = useAccountCtx();
  const plan = getPlan(account.planId);
  const cancelled = Boolean(account.cancelAt);

  return (
    <div className="space-y-6">
      <PageTitle title="Account" sub={`Member since ${fmtDate(account.createdAt)}`} />

      <Card>
        <div className="-mx-5 -mt-5 mb-5 rounded-t-xl bg-gradient-to-r from-brand to-[#0b4f33] px-5 py-3 text-sm font-semibold text-white sm:-mx-6 sm:-mt-6 sm:px-6">
          {cancelled ? `Membership ends ${fmtDate(account.cancelAt)}` : "Membership details"}
        </div>
        <p className="text-xl font-bold">{plan?.name} plan</p>
        <p className="text-neutral-600">{plan ? `${naira(plan.price)}/month · ${plan.resolution}` : ""}</p>
        <p className="mt-3 text-sm text-neutral-600">
          {cancelled ? "You won't be charged again." : `Next payment: ${fmtDate(account.payment?.renewsAt)}`}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>
          {methodLabel(account.payment?.method, account.payment?.last4)}
        </p>
        <div className="mt-4">
          <LinkRow href="/account/plan" label="Change plan" />
          <LinkRow href="/account/payment" label="Manage payment method" />
          <LinkRow href="/account/billing" label="Billing history" sub="Receipts for every payment" />
          {cancelled ? (
            <LinkRow href="/account/cancel" label="Restart membership" />
          ) : (
            <LinkRow href="/account/cancel" label="Cancel membership" danger />
          )}
        </div>
      </Card>

      <Card title="Security & privacy">
        <LinkRow href="/account/security" label="Email & password" sub={account.email} />
        <LinkRow href="/account/devices" label="Devices" sub={`${devicesOf(account).length} device${devicesOf(account).length === 1 ? "" : "s"} signed in`} />
        <LinkRow href="/account/notifications" label="Notifications" sub="Email and push preferences" />
      </Card>

      <Card title="Profiles & parental controls">
        {account.profiles.map((p) => (
          <ProfileRow key={p.id} id={p.id} name={p.name} avatar={p.avatar} kids={p.kids} />
        ))}
      </Card>
    </div>
  );
}

function ProfileRow({ id, name, avatar, kids }: { id: string; name: string; avatar: number; kids: boolean }) {
  return (
    <Link href={`/account/profile?id=${id}`} className="flex items-center gap-4 border-t border-neutral-200 py-3 first:border-t-0 hover:bg-neutral-50">
      <Avatar index={avatar} kids={kids} className="h-12 w-12" />
      <span className="flex-1">
        <span className="block font-semibold">{name}</span>
        <span className="block text-sm text-neutral-500">{kids ? "Kids profile" : "Language, maturity, PIN, playback"}</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 5 7 7-7 7" /></svg>
    </Link>
  );
}
