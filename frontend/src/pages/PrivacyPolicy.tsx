import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 1, 2025</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>We collect the following categories of information when you use ISIBI:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Account Information:</strong> Name, email address, company name, and billing details provided during registration.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Call logs, duration, timestamps, and feature usage analytics to improve the Service.</li>
              <li><strong className="text-foreground">Voice Data:</strong> Transcripts generated during AI-powered calls, processed solely to deliver the Service.</li>
              <li><strong className="text-foreground">Technical Data:</strong> IP address, browser type, device information, and cookies for security and performance purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve the ISIBI platform</li>
              <li>Process billing and manage your account</li>
              <li>Send transactional notifications (e.g., billing receipts, usage alerts)</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-2">We do <strong className="text-foreground">not</strong> sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Sharing</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Service Providers:</strong> Third-party vendors (e.g., cloud hosting, payment processors, voice synthesis providers) who process data on our behalf under strict contractual obligations.</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> When required by law, regulation, or valid legal process.</li>
              <li><strong className="text-foreground">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with prior notice to affected users.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide the Service. Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data, including encryption in transit (TLS 1.2+), encryption at rest (AES-256), access controls, and regular security audits. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access, correct, or delete your personal data</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Request data portability</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:support@isibi.ai" className="text-primary hover:underline">support@isibi.ai</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We may also use analytics cookies to understand how users interact with the Service. You can manage cookie preferences through your browser settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Children's Privacy</h2>
            <p>The Service is not directed to individuals under 18. We do not knowingly collect personal information from children. If we learn that we have collected data from a child, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our website and updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:support@isibi.ai" className="text-primary hover:underline">support@isibi.ai</a>.</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
