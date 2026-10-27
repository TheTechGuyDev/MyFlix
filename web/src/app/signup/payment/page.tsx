import SignupShell from "@/components/auth/SignupShell";
import PaymentForm from "@/components/auth/PaymentForm";

export const metadata = { title: "Payment | MyFlix" };

export default function PaymentPage() {
  return (
    <SignupShell>
      <PaymentForm />
    </SignupShell>
  );
}
