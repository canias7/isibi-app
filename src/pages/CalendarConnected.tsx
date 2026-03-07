import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function CalendarConnected() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const agentId = searchParams.get("agent_id");

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/settings");
    }, 3000);
    return () => clearTimeout(timer);
  }, [agentId, navigate]);

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Google Calendar Connected!</h1>
        <p className="text-muted-foreground">Your AI agent can now book appointments automatically.</p>
        <p className="text-sm text-muted-foreground">Redirecting you back…</p>
      </motion.div>
    </div>
  );
}
