import { Navbar } from "@/components/Navbar";
import { motion } from "framer-motion";
import { GitBranch, Lock } from "lucide-react";

export default function Workflow() {
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="flex flex-col items-center justify-center gap-6 text-center mt-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20"
          >
            <GitBranch className="h-10 w-10 text-primary" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-foreground">Workflow</h2>
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                <Lock className="h-3 w-3" />
                Coming Soon
              </span>
            </div>
            <p className="text-muted-foreground max-w-md">
              Build and automate complex workflows for your AI agents. Stay tuned!
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
