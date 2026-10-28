import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy Policy | MyFlix" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="28 October 2026">
      <p>This policy explains what personal information MyFlix Nigeria collects, why, and the choices you have. We follow the Nigeria Data Protection Act 2023 and the guidance of the Nigeria Data Protection Commission (NDPC).</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, password (stored only as a secure hash by our sign-in provider), phone number if you add one, and your plan.</li>
        <li><b>Profiles:</b> profile names, avatars, language, maturity settings and limits you set. Profile PINs are stored only as a hash.</li>
        <li><b>Viewing:</b> what you watch, how far you got, ratings, My List, reminders and the amount of data used, so we can resume playback, recommend titles and show your data meter.</li>
        <li><b>Payments:</b> payment references, amounts, the last 4 digits and type of your card and its expiry, from Paystack. Paystack holds your full card details; we never see them.</li>
        <li><b>Devices:</b> device type, browser or app, approximate location (city) and when it was last used, to show your Devices page, enforce screen limits and protect your account.</li>
        <li><b>Support:</b> messages you send us.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide the service you signed up for (contract): your account, playback, downloads, billing and support.</li>
        <li>To keep MyFlix secure and prevent fraud and account sharing (legitimate interest).</li>
        <li>To meet legal duties, such as keeping payment records for tax (legal obligation).</li>
        <li>To send offers and news only if you agreed (consent). You can turn these off any time in Account, Notifications.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We don&apos;t sell your personal information. We share it only with service providers who process it for us under contract: Supabase (database and sign-in), Paystack (payments), Mux (video streaming), Resend (email) and Termii (SMS), and with authorities when the law requires. Some providers store data outside Nigeria; we rely on adequate safeguards as required by the NDPA.</p>

      <h2>How long we keep it</h2>
      <p>We keep your information while your account is open. If you delete your account, we delete your profiles, viewing history and lists straight away. Payment records are kept for 6 years without being linked to your account, as required for accounting and tax. Support messages are kept for 2 years.</p>

      <h2>Your rights</h2>
      <ul>
        <li>See and download your data: Account, Privacy &amp; data, Download my data.</li>
        <li>Correct it: update your details in Account.</li>
        <li>Delete it: Account, Privacy &amp; data, Delete my account.</li>
        <li>Object to marketing, withdraw consent, or ask us to restrict processing: email us.</li>
        <li>Complain to the Nigeria Data Protection Commission if you&apos;re not happy with our answer.</li>
      </ul>

      <h2>Security</h2>
      <p>Data is encrypted in transit, access is restricted by strict database rules, staff need two-step sign-in, and every staff action is logged.</p>

      <h2>Children</h2>
      <p>Accounts are for adults. Kids profiles are managed by the account holder, and we don&apos;t knowingly collect information directly from children.</p>

      <h2>Contact</h2>
      <p>Data protection questions: <a className="text-brand" href="mailto:privacy@myflix.ng">privacy@myflix.ng</a>. We reply within 30 days.</p>
    </LegalPage>
  );
}
