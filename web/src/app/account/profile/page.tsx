import { Suspense } from "react";
import { ProfileSettingsPage } from "@/components/account/Settings";

export default function Page() {
  return (
    <Suspense>
      <ProfileSettingsPage />
    </Suspense>
  );
}
