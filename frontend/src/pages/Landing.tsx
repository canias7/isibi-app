import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { LandingSidebar } from "@/components/landing/LandingSidebar";
import { Footer } from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <HeroSection />
      <Footer />
    </div>
  );
}
