/**
 * Motion primitives — ready-to-use animated wrappers using framer-motion.
 * Drop any of these around your existing components to add smooth animations.
 *
 * Usage examples:
 *   <FadeIn>  <YourComponent />  </FadeIn>
 *   <SlideIn direction="left">  <Card />  </SlideIn>
 *   <ScaleIn>  <Button />  </ScaleIn>
 *   <StaggerChildren>  {items.map(i => <StaggerItem key={i.id}><Card /></StaggerItem>)}  </StaggerChildren>
 *   <AnimatedCounter value={1234} />
 */

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Base timing presets ────────────────────────────────────────────────────────
export const ease = {
  smooth:  [0.4, 0, 0.2, 1],
  spring:  { type: "spring", stiffness: 300, damping: 30 },
  bounce:  { type: "spring", stiffness: 400, damping: 15 },
  gentle:  { type: "spring", stiffness: 150, damping: 25 },
} as const;

// ── FadeIn ─────────────────────────────────────────────────────────────────────
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}
export function FadeIn({ children, delay = 0, duration = 0.4, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, delay, ease: ease.smooth as number[] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── SlideIn ────────────────────────────────────────────────────────────────────
type Direction = "up" | "down" | "left" | "right";
interface SlideInProps {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
  distance?: number;
  className?: string;
}

const dirOffset = (d: Direction, px: number) => ({
  up:    { y:  px, x: 0 },
  down:  { y: -px, x: 0 },
  left:  { x:  px, y: 0 },
  right: { x: -px, y: 0 },
}[d]);

export function SlideIn({ children, direction = "up", delay = 0, distance = 20, className }: SlideInProps) {
  const offset = dirOffset(direction, distance);
  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{ ...ease.gentle, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── ScaleIn ────────────────────────────────────────────────────────────────────
interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}
export function ScaleIn({ children, delay = 0, className }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ ...ease.bounce, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Stagger container + items ──────────────────────────────────────────────────
const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: ease.gentle },
};

export function StaggerChildren({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ── AnimatedCounter ────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  decimals?: number;
}
export function AnimatedCounter({ value, prefix = "", suffix = "", duration = 1.2, className, decimals = 0 }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = display;
    startTimeRef.current = null;

    const step = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const progress = Math.min((ts - startTimeRef.current) / (duration * 1000), 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startRef.current + (value - startRef.current) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ── HoverScale — wraps any element with a subtle scale on hover ───────────────
export function HoverScale({ children, scale = 1.03, className }: { children: React.ReactNode; scale?: number; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: scale - 0.02 }}
      transition={ease.bounce}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </motion.div>
  );
}

// ── PageTransition — wrap a whole page/view ───────────────────────────────────
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: ease.smooth as number[] }}
      className={cn("h-full w-full", className)}
    >
      {children}
    </motion.div>
  );
}

// Re-export commonly used framer-motion primitives for convenience
export { motion, AnimatePresence };
