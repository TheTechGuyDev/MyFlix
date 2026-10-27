import Hero from "@/components/landing/Hero";
import Trending from "@/components/landing/Trending";
import Reasons from "@/components/landing/Reasons";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Trending />
      <Reasons />
      <Faq />
      <Footer />
    </main>
  );
}
