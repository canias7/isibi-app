import { motion } from "framer-motion";

const logos = [
  { name: "TechCorp", text: "TechCorp" },
  { name: "StartupAI", text: "StartupAI" },
  { name: "FinanceHub", text: "FinanceHub" },
  { name: "HealthFirst", text: "HealthFirst" },
  { name: "RetailPro", text: "RetailPro" },
  { name: "ServiceNow", text: "ServiceNow" },
];

export function LogoBar() {
  return (
    <section className="py-8 border-t border-border/30 bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 lg:gap-16"
        >
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-300"
            >
              <span className="text-lg sm:text-xl font-semibold tracking-tight">
                {logo.text}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
