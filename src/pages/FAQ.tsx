import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { HelpCircle, Phone, Bot, CreditCard, Shield, Zap, Settings } from "lucide-react";

const faqCategories = [
  {
    title: "Getting Started",
    icon: Zap,
    questions: [
      {
        q: "What is ISIBI?",
        a: "ISIBI is an AI-powered phone agent platform built for restaurants and businesses. Our AI agents can answer calls, take reservations, handle orders, and manage customer inquiries — 24/7, in multiple languages.",
      },
      {
        q: "How do I set up my first AI agent?",
        a: "After signing up, head to the Customer Dashboard and click 'Create Agent.' You'll walk through a simple setup wizard where you configure your agent's voice, personality, business hours, and the tasks it should handle. Most users are live within 15 minutes.",
      },
      {
        q: "Do I need any technical knowledge?",
        a: "Not at all. ISIBI is designed for business owners, not engineers. Everything is configured through our intuitive dashboard — no coding required.",
      },
    ],
  },
  {
    title: "Phone Numbers & Calls",
    icon: Phone,
    questions: [
      {
        q: "Can I use my existing business phone number?",
        a: "Yes! You can forward your existing number to ISIBI, or we can provision a new local or toll-free number for you. We support number porting in most regions.",
      },
      {
        q: "How many concurrent calls can ISIBI handle?",
        a: "There's no practical limit. Unlike a human receptionist, your AI agent can handle hundreds of simultaneous calls without any wait times or busy signals.",
      },
      {
        q: "What happens if the AI can't answer a question?",
        a: "You can configure fallback behavior — the agent can transfer the call to a live person, take a message, or offer to call back. You're always in control of the escalation path.",
      },
    ],
  },
  {
    title: "AI Agent Capabilities",
    icon: Bot,
    questions: [
      {
        q: "What languages does ISIBI support?",
        a: "Our agents support 30+ languages out of the box, including English, Spanish, French, Mandarin, Arabic, and more. The agent can automatically detect the caller's language and switch seamlessly.",
      },
      {
        q: "Can the AI agent take orders or reservations?",
        a: "Absolutely. ISIBI integrates with popular POS and reservation systems like Square, Shopify, Toast, OpenTable, and more. Your agent can take orders, book tables, and update your systems in real time.",
      },
      {
        q: "How natural does the AI voice sound?",
        a: "We use state-of-the-art voice synthesis from ElevenLabs to deliver incredibly natural, human-like voices. You can choose from a library of voices or clone your own brand voice.",
      },
      {
        q: "Can I customize what the agent says?",
        a: "Yes. You provide a system prompt, menu details, business policies, and FAQs. The agent uses this knowledge base to respond accurately. You can update it anytime from the dashboard.",
      },
    ],
  },
  {
    title: "Integrations",
    icon: Settings,
    questions: [
      {
        q: "Which POS systems do you integrate with?",
        a: "We currently integrate with Square and Shopify, with Toast, Clover, SpotOn, Olo, Aloha by NCR, and SkyTab coming soon. We also support Google Calendar, Slack, and Microsoft Teams.",
      },
      {
        q: "Can I connect ISIBI to my existing tools?",
        a: "Yes. Beyond our native integrations, we offer webhook support and a REST API so you can connect ISIBI to virtually any system your business uses.",
      },
    ],
  },
  {
    title: "Billing & Pricing",
    icon: CreditCard,
    questions: [
      {
        q: "How does pricing work?",
        a: "ISIBI uses a usage-based model. You're billed per minute of call time. There are no setup fees or long-term contracts. You can set spending limits and enable auto-recharge to keep your agent running smoothly.",
      },
      {
        q: "Can I set a budget limit?",
        a: "Absolutely. In the Billing section, you can configure spending caps and auto-recharge thresholds so you never get an unexpected bill.",
      },
    ],
  },
  {
    title: "Security & Privacy",
    icon: Shield,
    questions: [
      {
        q: "Is my data secure?",
        a: "Yes. All data is encrypted in transit and at rest. We follow industry-standard security practices and never share your data with third parties.",
      },
      {
        q: "Is ISIBI compliant with privacy regulations?",
        a: "We are committed to compliance with GDPR, CCPA, and other applicable privacy regulations. Our platform includes tools for data management and consent handling.",
      },
    ],
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to Home
        </Button>
      </div>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="hero-glow top-0 left-1/2 -translate-x-1/2 opacity-40" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6"
          >
            <HelpCircle className="h-4 w-4" />
            Frequently Asked Questions
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold mb-4"
          >
            Got <span className="gradient-text">questions?</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Everything you need to know about ISIBI and how it can transform
            your business communications.
          </motion.p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-10">
          {faqCategories.map((category, catIdx) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * catIdx }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <category.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  {category.title}
                </h2>
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`${catIdx}-${idx}`}
                      className="border-border/50 px-6"
                    >
                      <AccordionTrigger className="text-left text-foreground hover:no-underline hover:text-primary transition-colors">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
