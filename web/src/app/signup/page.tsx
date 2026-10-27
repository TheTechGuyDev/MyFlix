import { Suspense } from "react";
import SignupShell from "@/components/auth/SignupShell";
import CreateAccount from "@/components/auth/CreateAccount";

export const metadata = { title: "Create your account | MyFlix" };

export default function SignupPage() {
  return (
    <SignupShell>
      <Suspense>
        <CreateAccount />
      </Suspense>
    </SignupShell>
  );
}
