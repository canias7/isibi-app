import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 1, 2025</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the ISIBI platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service. ISIBI reserves the right to update these terms at any time, and continued use of the Service constitutes acceptance of any modifications.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p>ISIBI provides AI-powered phone agent services for businesses, including automated call handling, voice synthesis, and integrations with third-party platforms. The Service is provided on a usage-based billing model, and features may vary depending on your subscription plan.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Account Registration</h2>
            <p>To use the Service, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify ISIBI immediately of any unauthorized use of your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Engage in any unlawful, harassing, or fraudulent activity</li>
              <li>Make robocalls or spam calls in violation of applicable regulations (TCPA, TSR, etc.)</li>
              <li>Impersonate any person or entity without proper disclosure</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Billing and Payment</h2>
            <p>Usage is billed on a per-minute basis at the rates displayed in your dashboard. All charges are non-refundable except where required by law. ISIBI reserves the right to modify pricing with 30 days' written notice. Failure to pay outstanding balances may result in suspension or termination of your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Intellectual Property</h2>
            <p>The Service, including all software, designs, text, and other materials, is the property of ISIBI and is protected by intellectual property laws. You retain ownership of any data or content you provide through the Service. By using the Service, you grant ISIBI a limited license to process your data solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, ISIBI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. ISIBI's total liability shall not exceed the amount you paid to ISIBI in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Termination</h2>
            <p>Either party may terminate this agreement at any time. ISIBI may suspend or terminate your access to the Service immediately if you violate these terms. Upon termination, your right to use the Service ceases, and ISIBI may delete your data after a 30-day grace period.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict-of-law provisions. Any disputes shall be resolved in the state or federal courts located in Delaware.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact</h2>
            <p>If you have any questions about these Terms, please contact us at <a href="mailto:support@isibi.ai" className="text-primary hover:underline">support@isibi.ai</a>.</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
