import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Shield, Server, Lock, Database, CreditCard, Users, Eye, Globe, Bell, FileCheck } from "lucide-react";

const sections = [
  {
    title: "Infrastructure",
    icon: Server,
    items: [
      { label: "Hosted on Render", desc: "All services are deployed on Render's SOC 2 Type II compliant cloud infrastructure with automatic failover and high availability." },
      { label: "HTTPS / SSL/TLS Encryption", desc: "All data in transit is encrypted using TLS 1.2+ (SSL). Every connection to ISIBI is secured end-to-end." },
      { label: "Secure Environment Variables", desc: "All secrets and configuration values are stored as encrypted environment variables — never committed to source code." },
      { label: "DDoS Protection", desc: "Built-in DDoS mitigation at the infrastructure level protects against volumetric and application-layer attacks." },
      { label: "Automated Deployments", desc: "Zero-downtime deployments with automatic rollback ensure service continuity and reduce human error." },
    ],
  },
  {
    title: "Data Protection",
    icon: Database,
    items: [
      { label: "Database Encryption at Rest", desc: "All database data is encrypted at rest using AES-256, ensuring your data is protected even at the storage layer." },
      { label: "No Data Sold — Ever", desc: "We do not sell, rent, or share your data with third parties for marketing or advertising purposes." },
      { label: "Tenant Data Isolation", desc: "Each customer's data is logically isolated. No cross-tenant data access is possible." },
      { label: "Encrypted API Keys", desc: "All API keys are encrypted before storage and are never exposed in plaintext in logs or responses." },
      { label: "Automatic Data Backups", desc: "Regular automated backups ensure data durability and enable point-in-time recovery." },
      { label: "Data Retention Controls", desc: "You control how long call logs and transcripts are retained. Configure retention periods from your dashboard." },
    ],
  },
  {
    title: "Access Control",
    icon: Users,
    items: [
      { label: "Role-Based Admin Access", desc: "Granular role-based access control (RBAC) ensures team members only access what they need." },
      { label: "Secure Authentication", desc: "Industry-standard authentication with password hashing (bcrypt), session management, and optional MFA." },
      { label: "Audit Logging", desc: "All administrative actions are logged with timestamps and user attribution for full accountability." },
      { label: "Session Management", desc: "Automatic session expiration and token rotation prevent unauthorized access from stale sessions." },
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    items: [
      { label: "Stripe Handles PCI Compliance", desc: "All payment processing is handled by Stripe, a PCI DSS Level 1 certified provider — the highest level of certification." },
      { label: "No Card Data on Our Servers", desc: "Credit card numbers, CVVs, and sensitive payment details never touch our servers. Stripe manages everything securely." },
      { label: "Tokenized Billing", desc: "Payment methods are tokenized by Stripe. We only store non-sensitive references to process recurring charges." },
    ],
  },
  {
    title: "Privacy & Compliance",
    icon: Eye,
    items: [
      { label: "GDPR-Ready Practices", desc: "We follow GDPR-aligned principles including data minimization, purpose limitation, and right-to-deletion support." },
      { label: "CCPA Compliance", desc: "California residents can exercise their rights under CCPA. Contact support@isibi.ai for data requests." },
      { label: "TCPA Compliance", desc: "ISIBI is designed to help businesses comply with TCPA regulations for automated calling and consent management." },
      { label: "Transparent Privacy Policy", desc: "Our privacy policy clearly outlines what we collect, how we use it, and your rights. No legalese surprises." },
    ],
  },
  {
    title: "Operational Security",
    icon: Shield,
    items: [
      { label: "Incident Response Plan", desc: "We maintain a documented incident response plan with defined escalation paths and notification procedures." },
      { label: "Dependency Monitoring", desc: "Automated scanning for vulnerable dependencies ensures third-party packages are patched promptly." },
      { label: "Uptime Monitoring", desc: "24/7 uptime monitoring with automated alerting ensures issues are detected and addressed immediately." },
      { label: "Responsible Disclosure", desc: "We welcome security researchers to report vulnerabilities. Contact support@isibi.ai for our disclosure process." },
    ],
  },
];

export default function Security() {
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Security</h1>
        </div>
        <p className="text-muted-foreground mb-12">
          At ISIBI, security isn't an afterthought — it's foundational. Here's how we protect your data and your customers' data.
        </p>

        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.title}>
              <div className="flex items-center gap-2 mb-4">
                <section.icon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              </div>
              <div className="grid gap-4">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm"
                  >
                    <h3 className="text-sm font-semibold text-foreground mb-1">{item.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 p-6 rounded-lg border border-primary/20 bg-primary/5 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Have a security concern?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We take every report seriously. Reach out and our team will respond promptly.
          </p>
          <a
            href="mailto:support@isibi.ai"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            support@isibi.ai
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
