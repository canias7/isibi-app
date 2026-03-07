import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import googleCalendarLogo from "@/assets/google-calendar-logo.png";
import slackLogo from "@/assets/slack-logo.png";
import teamsLogo from "@/assets/teams-logo.png";
import squareLogo from "@/assets/square-logo.png";
import shopifyLogo from "@/assets/shopify-logo.png";
import cloverLogo from "@/assets/clover-logo.png";
import toastLogo from "@/assets/toast-logo.png";
import opentableLogo from "@/assets/opentable-logo.png";
import spotonLogo from "@/assets/spoton-logo.png";
import oloLogo from "@/assets/olo-logo.png";
import alohaLogo from "@/assets/aloha-logo.png";
import skytabLogo from "@/assets/skytab-logo.png";

type Integration = {
  name: string;
  description: string;
  bgGlow: string;
  status: string;
  logo: string;
  whiteBg?: boolean;
};

const integrations: Integration[] = [
  { name: "Google Calendar", description: "Sync appointments and manage bookings seamlessly.", logo: googleCalendarLogo, bgGlow: "bg-blue-500/20", status: "live" },
  { name: "Shopify", description: "Full product catalog and order management.", logo: shopifyLogo, bgGlow: "bg-green-500/20", status: "live" },
  { name: "Slack", description: "Real-time notifications to your workspace.", logo: slackLogo, bgGlow: "bg-purple-500/20", status: "live" },
  { name: "Microsoft Teams", description: "Collaborate and receive updates in Teams.", logo: teamsLogo, bgGlow: "bg-indigo-500/20", status: "live" },
  { name: "Square", description: "Point-of-sale and payment processing.", logo: squareLogo, bgGlow: "bg-cyan-500/20", status: "live", whiteBg: true },
  { name: "Clover", description: "All-in-one POS and business management.", logo: cloverLogo, bgGlow: "bg-emerald-500/20", status: "coming" },
  { name: "Toast", description: "Restaurant-first POS and management platform.", logo: toastLogo, bgGlow: "bg-orange-500/20", status: "coming" },
  { name: "OpenTable", description: "Reservation management and guest insights.", logo: opentableLogo, bgGlow: "bg-red-500/20", status: "coming" },
  { name: "SpotOn", description: "Integrated payments, POS, and marketing tools.", logo: spotonLogo, bgGlow: "bg-sky-500/20", status: "coming", whiteBg: true },
  { name: "Olo", description: "Digital ordering and delivery for restaurants.", logo: oloLogo, bgGlow: "bg-teal-500/20", status: "coming" },
  { name: "Aloha by NCR", description: "Enterprise restaurant management system.", logo: alohaLogo, bgGlow: "bg-violet-500/20", status: "coming" },
  { name: "SkyTab", description: "Next-gen POS with built-in analytics.", logo: skytabLogo, bgGlow: "bg-fuchsia-500/20", status: "coming" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 20 } },
};

export default function IntegrationsShowcase() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative flex flex-col">
      <Navbar />
      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-24">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to Home
        </Button>
      </div>

      <section className="relative flex-1 pt-28 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.15)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.15)_1px,transparent_1px)] bg-[size:80px_80px]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-20 left-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight gradient-text mb-4">
              Integrations
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Isibi connects with the tools you already use — powering your business with AI across every platform.
            </p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {integrations.map((integration) => (
              <motion.div
                key={integration.name}
                variants={item}
                className="group relative rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.15)] overflow-hidden"
              >
                {/* Glow effect on hover */}
                <div className={`absolute -top-10 -right-10 w-32 h-32 ${integration.bgGlow} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-lg overflow-hidden ${integration.whiteBg ? "bg-white" : "bg-background"}`}>
                      <img src={integration.logo} alt={integration.name} className="h-8 w-8 object-contain" />
                    </div>
                    {integration.status === "coming" && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/50">
                        Coming Soon
                      </span>
                    )}
                    {integration.status === "live" && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Live
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{integration.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{integration.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
