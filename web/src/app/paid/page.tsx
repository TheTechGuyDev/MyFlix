import Link from "next/link";
import AuthBackdrop from "@/components/auth/AuthBackdrop";

export const metadata = { title: "Payment complete | MyFlix" };

/** Where Paystack sends members who paid inside the MyFlix app. The app confirms the payment when they return. */
export default function PaidPage() {
  return (
    <AuthBackdrop>
      <div className="w-full space-y-4 bg-black/75 px-5 py-10 text-center sm:max-w-md sm:rounded-lg sm:px-12 sm:py-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl">✓</div>
        <h1 className="text-3xl font-bold">Thanks, you&apos;re all set</h1>
        <p className="text-muted">Go back to the MyFlix app. It confirms your payment and you can start watching straight away.</p>
        <p className="text-sm text-muted">Paid on a computer? Sign in on the website to watch here instead.</p>
        <Link href="/browse" className="inline-block rounded bg-brand px-6 py-3 font-semibold hover:bg-brand-hover">Watch on the website</Link>
      </div>
    </AuthBackdrop>
  );
}
