import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Phone, 
  Bot, 
  FileText, 
  CreditCard,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems: { label: string; href: string; icon: any; comingSoon?: boolean }[] = [];

const landingNavItems: { label: string; href: string }[] = [];

export function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLanding = location.pathname === "/";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to={localStorage.getItem("token") ? "/home" : "/"} className="flex items-center gap-2">
            <span className="text-xl font-bold gradient-text">ISIBI</span>
          </Link>

          {/* Desktop Navigation - Landing */}
          {isLanding && (
            <div className="hidden lg:flex items-center gap-1">
              {landingNavItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Desktop Navigation - Dashboard */}
          {!isLanding && (
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.comingSoon ? "#" : item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                      item.comingSoon && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.comingSoon && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        Soon
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                        transition={{ type: "spring", duration: 0.5 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            {isLanding && (
              <>
                <Link
                  to="/faq"
                  className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                >
                  FAQ
                </Link>
                <Link
                  to="/integrations"
                  className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                >
                  Integrations
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild 
                  className="uppercase tracking-wider text-xs border-primary/50 hover:bg-primary/10 text-primary"
                >
                  <Link to="/login">Customer Dashboard</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
        >
          <div className="px-4 py-4 space-y-2">
            {isLanding ? (
              <>
                {landingNavItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 uppercase tracking-wider"
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            ) : (
              navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.comingSoon ? "#" : item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                      item.comingSoon && "opacity-50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.comingSoon && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-secondary">
                        Soon
                      </span>
                    )}
                  </Link>
                );
              })
            )}
            <div className="pt-4 border-t border-border/50">
              <Button variant="hero" className="w-full" asChild>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Customer Dashboard</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
