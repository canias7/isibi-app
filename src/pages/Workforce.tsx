import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plug, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TeamTableBuilder from "@/components/TeamTableBuilder";
import DashboardIntegrations from "@/components/dashboard/DashboardIntegrations";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "team",         label: "Team",         icon: Users },
  { id: "integrations", label: "Integrations",  icon: Plug  },
] as const;

type Tab = typeof TABS[number]["id"];

export default function Workforce() {
  const [activeTab, setActiveTab] = useState<Tab>("team");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ── Top bar ── */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <span className="text-indigo-400 text-xs font-bold">AI</span>
          </div>
          <span className="text-sm font-semibold text-white/80">Workforce</span>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="border-b border-white/[0.06] px-6 flex items-center gap-1 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-white"
                : "text-white/40 hover:text-white/70"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}

            {/* Active underline */}
            {activeTab === tab.id && (
              <motion.span
                layoutId="workforce-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "team" && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-center p-6 md:p-12 min-h-full"
            >
              <TeamTableBuilder
                className="w-full max-w-3xl"
                onSeatClick={(seat) => console.log("Seat clicked:", seat)}
                onAddAgent={(seat) => console.log("Add agent to:", seat.position)}
              />
            </motion.div>
          )}

          {activeTab === "integrations" && (
            <motion.div
              key="integrations"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="p-6 md:p-10 max-w-6xl mx-auto w-full"
            >
              {/* Section heading */}
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white">Integrations</h1>
                <p className="text-sm text-white/40 mt-1">
                  Connect external services to your account. Each connection is scoped to your account only.
                </p>
              </div>

              {/* Reuse the existing integrations panel — it already handles all auth / state */}
              <DashboardIntegrations />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
