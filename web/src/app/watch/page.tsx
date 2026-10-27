import { Suspense } from "react";
import WatchApp from "@/components/player/WatchApp";

export const metadata = { title: "Watch | MyFlix" };

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <WatchApp />
    </Suspense>
  );
}
