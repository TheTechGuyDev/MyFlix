import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Cookie Policy | MyFlix" };

export default function Cookies() {
  return (
    <LegalPage title="Cookie Policy" updated="28 October 2026">
      <p>MyFlix uses only essential cookies and browser storage. We don&apos;t use advertising or cross-site tracking cookies.</p>
      <h2>What we store on your device</h2>
      <ul>
        <li><b>Sign-in session:</b> keeps you signed in securely (refreshed automatically).</li>
        <li><b>Active profile and device ID:</b> remembers who&apos;s watching and lets you sign this device out remotely.</li>
        <li><b>Preferences:</b> language, cookie notice choice and similar settings.</li>
        <li><b>Video player:</b> temporary data our video provider needs to stream smoothly.</li>
      </ul>
      <h2>Your choices</h2>
      <p>Because these are needed for MyFlix to work, they can&apos;t be switched off in the site. You can clear them in your browser settings at any time; you&apos;ll then need to sign in again.</p>
      <h2>Contact</h2>
      <p>Questions: <a className="text-brand" href="mailto:privacy@myflix.ng">privacy@myflix.ng</a>.</p>
    </LegalPage>
  );
}
