import { motion } from "framer-motion";
import { 
  Activity, 
  Phone, 
  Bot, 
  PhoneCall,
  Wifi,
  Server
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatusCard } from "@/components/StatusCard";
import { ApiConnectionPanel } from "@/components/ApiConnectionPanel";
import { PlaceholderCard } from "@/components/PlaceholderCard";

export default function Dashboard() {
  return (
    <div className="min-h-screen relative">
      <Navbar />
      
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor your AI phone agents and manage your platform
            </p>
          </motion.div>

          {/* Platform Status Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Platform Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard
                title="API Status"
                value="Pending"
                description="Configure your backend connection"
                icon={Server}
                status="neutral"
              />
              <StatusCard
                title="Active Agents"
                value="0"
                description="No agents configured yet"
                icon={Bot}
                status="neutral"
              />
              <StatusCard
                title="Phone Numbers"
                value="0"
                description="No numbers connected"
                icon={Phone}
                status="neutral"
              />
              <StatusCard
                title="Calls Today"
                value="0"
                description="Waiting for first call"
                icon={PhoneCall}
                status="neutral"
              />
            </div>
          </section>

          {/* API Connection Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Backend Connection
            </h2>
            <div className="max-w-2xl">
              <ApiConnectionPanel />
            </div>
          </section>

          {/* Coming Soon Sections */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Platform Features
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlaceholderCard
                title="Agent Management"
                description="Create and configure AI voice agents with custom personalities, scripts, and behaviors."
                icon={Bot}
              />
              <PlaceholderCard
                title="Phone Number Management"
                description="Connect existing phone numbers or provision new ones for your AI agents."
                icon={Phone}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
