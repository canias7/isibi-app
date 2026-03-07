import { motion } from "framer-motion";
import { LucideIcon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceholderCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}

export function PlaceholderCard({
  title,
  description,
  icon: Icon,
  className,
}: PlaceholderCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn(
        "glass-card rounded-xl p-6 opacity-60 transition-all duration-300",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/50 border border-border">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              Coming Soon
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      
      {/* Placeholder content */}
      <div className="mt-6 space-y-3">
        <div className="h-10 rounded-lg bg-secondary/30 animate-pulse" />
        <div className="h-10 rounded-lg bg-secondary/20 animate-pulse" />
        <div className="h-10 rounded-lg bg-secondary/10 animate-pulse" />
      </div>
    </motion.div>
  );
}
