"use client";

import { getAccount, type Account } from "./account";
import { useStore } from "./store";

/** The signed-in account, re-rendering whenever it changes. `ready` is false until start-up finishes. */
export function useAccount() {
  const ready = useStore((s) => s.ready);
  useStore((s) => [s.account, s.profiles, s.billing, s.devices]);
  const account: Account | null = ready ? getAccount() : null;
  return { account, ready, setAccount: (_: Account | null) => void _ };
}
