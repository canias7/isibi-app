import { motion } from "framer-motion";
import { Clock, CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function DeveloperPending() {
  const email = localStorage.getItem("pending_email") || "";

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="w-full max-w-lg relative z-10 text-center"
      >
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link to="/">
            <span className="text-2xl font-bold gradient-text">ISIBI</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl p-10 shadow-xl">
          {/* Icon stack */}
          <div className="relative flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Clock className="h-9 w-9 text-primary" />
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
              className="absolute -bottom-1 -right-1 translate-x-4 flex h-8 w-8 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30"
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </motion.div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Application received!
          </h1>

          <p className="text-muted-foreground leading-relaxed mb-2">
            Thanks for applying for developer access. Our team will review your application and get back to you shortly.
          </p>

          {email && (
            <div className="flex items-center justify-center gap-2 mt-4 mb-6 rounded-xl bg-secondary/40 border border-border/40 px-4 py-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground font-medium">{email}</span>
            </div>
          )}

          {!email && <div className="mb-6" />}

          <p className="text-sm text-muted-foreground mb-8">
            We'll send you an email at the address above once your access has been approved. This usually takes 1–2 business days.
          </p>

          {/* Steps */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { step: "1", label: "Application submitted", done: true },
              { step: "2", label: "Under review", done: false, active: true },
              { step: "3", label: "Access granted", done: false },
            ].map(({ step, label, done, active }) => (
              <div key={step} className="flex flex-col items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border transition-all ${
                  done
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : active
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-500"
                    : "bg-secondary border-border text-muted-foreground"
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : step}
                </div>
                <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild variant="hero" className="w-full">
              <Link to="/login">
                Already approved? Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to home
              </Link>
            </Button>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Questions? Contact us at{" "}
          <a href="mailto:support@isibi.io" className="text-primary hover:underline">
            support@isibi.io
          </a>
        </p>
      </motion.div>
    </div>
  );
}
