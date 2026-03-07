import { Link, useLocation } from "react-router-dom";
import { Mic, GitBranch, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const sidebarItems: { label: string; href: string; icon: any }[] = [];

export function LandingSidebar() {
  const location = useLocation();

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed left-0 top-16 bottom-0 z-40 w-56 border-r border-border/50 bg-sidebar-background/80 backdrop-blur-xl flex flex-col"
    >
      <div className="flex-1 px-3 py-6 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.label}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="px-3 pb-6">
        <div className="px-4 py-3 rounded-lg bg-secondary/30 border border-border/30">
          <p className="text-xs text-muted-foreground">
            AI-powered tools for your business
          </p>
        </div>
      </div>
    </motion.aside>
  );
}
