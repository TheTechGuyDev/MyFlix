import { Suspense } from "react";
import AuthBackdrop from "@/components/auth/AuthBackdrop";
import ConfirmLink from "@/components/auth/ConfirmLink";

export const metadata = { title: "Confirming | MyFlix" };

export default function ConfirmPage() {
  return (
    <AuthBackdrop>
      <Suspense>
        <ConfirmLink />
      </Suspense>
    </AuthBackdrop>
  );
}
