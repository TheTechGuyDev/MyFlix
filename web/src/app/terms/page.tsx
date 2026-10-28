import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms of Use | MyFlix" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="28 October 2026">
      <p>These terms are an agreement between you and MyFlix Nigeria (&quot;MyFlix&quot;, &quot;we&quot;, &quot;us&quot;) for the MyFlix streaming service on the web, mobile apps and TV apps. By creating an account or using MyFlix you agree to them. If you don&apos;t agree, please don&apos;t use the service.</p>

      <h2>1. Membership</h2>
      <ul>
        <li>You must be 18 or older to create an account. Children may watch through a profile on an adult&apos;s account, under that adult&apos;s supervision.</li>
        <li>Your membership continues month to month (or year to year if you choose yearly billing) until you cancel.</li>
        <li>Each plan sets the video quality, the number of screens that can watch at the same time, and the number of devices you can download on. Your plan is shown in Account.</li>
        <li>An account is for you and the people you live with. Sharing your sign-in outside your household isn&apos;t allowed.</li>
      </ul>

      <h2>2. Billing and cancellation</h2>
      <ul>
        <li>Payments are processed by Paystack. We never see or store your full card number.</li>
        <li>You authorise us to charge your saved payment method at the start of each billing period. If a charge fails we&apos;ll let you know, and your access may pause until the payment is made.</li>
        <li>Prices are in Nigerian naira and include any applicable VAT. We&apos;ll tell you at least 30 days before a price change takes effect, and you can cancel before then.</li>
        <li>You can cancel at any time in Account. You keep access until the end of the period you&apos;ve paid for. Payments aren&apos;t refundable for partial periods, except where the law requires a refund or where we decide to give one.</li>
        <li>Promo codes and gift cards have no cash value and can&apos;t be resold. Credit from a gift card is used before your payment method is charged.</li>
        <li>Referral rewards are given once per new paying member and may be withdrawn if they&apos;re obtained through fake or duplicate accounts.</li>
      </ul>

      <h2>3. Using MyFlix</h2>
      <ul>
        <li>MyFlix is for personal, non-commercial viewing only. Public screenings, rebroadcasting and charging others to watch aren&apos;t allowed.</li>
        <li>You may not copy, download (except through our in-app download feature), record, share, reverse-engineer or work around our content protection, including watermarks, screenshot blocking and screen limits.</li>
        <li>Titles available change over time and may differ by region. Downloads expire and need you to go online from time to time.</li>
        <li>Video quality depends on your plan, device and internet speed. Streaming uses mobile data; your network provider&apos;s charges apply.</li>
      </ul>

      <h2>4. Your account</h2>
      <ul>
        <li>Keep your password and sign-in codes private. You&apos;re responsible for activity on your account. Tell us straight away if you think someone else has used it.</li>
        <li>We may suspend or close accounts that break these terms, are used for fraud, or put other members or MyFlix at risk. Where reasonable we&apos;ll tell you why.</li>
        <li>You can delete your account at any time in Account, Privacy &amp; data.</li>
      </ul>

      <h2>5. The service</h2>
      <p>We work hard to keep MyFlix available, but we don&apos;t promise it will be free of interruptions or errors. We may change, add or remove features. To the extent the law allows, MyFlix isn&apos;t liable for indirect or consequential losses, and our total liability to you is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits your rights under the Federal Competition and Consumer Protection Act 2018 or other laws that can&apos;t be excluded.</p>

      <h2>6. Changes to these terms</h2>
      <p>We may update these terms. If a change matters, we&apos;ll tell you by email or in the app before it takes effect. Continuing to use MyFlix after that means you accept the new terms.</p>

      <h2>7. Law and disputes</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. If you have a complaint, contact us first and we&apos;ll try to resolve it. If we can&apos;t, the courts of Lagos State will have jurisdiction, without affecting your right to complain to the Federal Competition and Consumer Protection Commission.</p>

      <h2>8. Contact</h2>
      <p>MyFlix Nigeria, Lagos. Email <a className="text-brand" href="mailto:help@myflix.ng">help@myflix.ng</a> or use the Help Centre.</p>
    </LegalPage>
  );
}
