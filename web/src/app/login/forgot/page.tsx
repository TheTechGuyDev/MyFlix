import AuthBackdrop from "@/components/auth/AuthBackdrop";
import ForgotPassword from "@/components/auth/ForgotPassword";

export const metadata = { title: "Reset password | MyFlix" };

export default function ForgotPage() {
  return (
    <AuthBackdrop>
      <ForgotPassword />
    </AuthBackdrop>
  );
}
