import { motion } from "framer-motion";
import { Phone, Bot, Zap, Shield, Mic, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Phone,
    title: "Phone Integration",
    description: "Connect any phone number or provision new ones instantly. Support for Twilio, Vonage, and more.",
  },
  {
    icon: Bot,
    title: "Custom Assistants",
    description: "Build AI agents with custom personalities, knowledge bases, and conversation flows.",
  },
  {
    icon: Mic,
    title: "Natural Voices",
    description: "Choose from dozens of ultra-realistic voices or clone your own for brand consistency.",
  },
  {
    icon: Zap,
    title: "Low Latency",
    description: "Sub-500ms response times for natural, flowing conversations that feel human.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Track call outcomes, sentiment, and performance with detailed real-time dashboards.",
  },
  {
    icon: Shield,
    title: "Enterprise Ready",
    description: "SOC2 compliant, HIPAA ready, with advanced security and data handling controls.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Everything you need to
            <br />
            <span className="gradient-text">automate phone calls</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The most configurable API to build leading voice AI products and scale phone operations.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
