import { Suspense } from "react";
import AuthBackdrop from "@/components/auth/AuthBackdrop";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign In | MyFlix" };

export default function LoginPage() {
  return (
    <AuthBackdrop>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthBackdrop>
  );
}
