import { Suspense } from "react";
import AuthBackdrop from "@/components/auth/AuthBackdrop";
import ResetPassword from "@/components/auth/ResetPassword";

export const metadata = { title: "New password | MyFlix" };

export default function ResetPage() {
  return (
    <AuthBackdrop>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </AuthBackdrop>
  );
}
