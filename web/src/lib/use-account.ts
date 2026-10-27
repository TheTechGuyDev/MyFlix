"use client";

import { useEffect, useState } from "react";
import { getAccount, type Account } from "./mock-auth";

/** Reads the signed-in account after mount (avoids hydration mismatch). */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccount(getAccount());
    setReady(true);
  }, []);

  return { account, setAccount, ready };
}
