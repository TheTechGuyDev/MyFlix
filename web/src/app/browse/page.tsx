import { Suspense } from "react";
import BrowseApp from "@/components/browse/BrowseApp";

export const metadata = { title: "Home | MyFlix" };

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <BrowseApp />
    </Suspense>
  );
}
