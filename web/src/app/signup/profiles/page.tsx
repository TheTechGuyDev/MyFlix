import SignupShell from "@/components/auth/SignupShell";
import ProfileSetup from "@/components/auth/ProfileSetup";

export const metadata = { title: "Set up profiles | MyFlix" };

export default function ProfileSetupPage() {
  return (
    <SignupShell>
      <ProfileSetup />
    </SignupShell>
  );
}
