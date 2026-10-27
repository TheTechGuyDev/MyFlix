import SignupShell from "@/components/auth/SignupShell";
import PlanPicker from "@/components/auth/PlanPicker";

export const metadata = { title: "Choose your plan | MyFlix" };

export default function PlanPage() {
  return (
    <SignupShell wide>
      <PlanPicker />
    </SignupShell>
  );
}
