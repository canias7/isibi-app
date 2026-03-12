import { cn } from "@/lib/utils";
import { LayoutDashboard, PhoneCall, Phone, CreditCard, Bot, Settings, LogOut, ChevronDown, Workflow as WorkflowIcon, Headphones, Code2, PanelLeftClose, PanelLeftOpen, PhoneOutgoing } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type DashboardTab = "assistant" | "overview" | "phone-numbers" | "billing" | "voice-library" | "settings" | "developer" | "outbound-calls";
export type SidebarMode = "developer" | "customer";

const developerNavItems: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
  { id: "assistant", label: "Agent", icon: Bot },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "outbound-calls", label: "Outbound Calls", icon: PhoneOutgoing },
  { id: "phone-numbers", label: "Phone Numbers", icon: Phone },
  { id: "billing", label: "Billing & Credits", icon: CreditCard },
  { id: "voice-library", label: "Voice Library", icon: Headphones },
  { id: "settings", label: "Settings", icon: Settings },
];

const customerNavItems: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
  { id: "assistant", label: "Agent", icon: Bot },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "outbound-calls", label: "Outbound Calls", icon: PhoneOutgoing },
  { id: "phone-numbers", label: "Phone Numbers", icon: Phone },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
];

const subItems: { id: DashboardTab; label: string; icon: React.ElementType; parent: DashboardTab }[] = [
  { id: "developer", label: "Developer", icon: Code2, parent: "settings" },
];

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  balance?: number | null;
  lowBalance?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mode?: SidebarMode;
}

export default function DashboardSidebar({ activeTab, onTabChange, balance, lowBalance, collapsed = false, onToggleCollapse, mode = "developer" }: DashboardSidebarProps) {
  const navigate = useNavigate();
  const navItems = mode === "customer" ? customerNavItems : developerNavItems;
  // Customer mode: hide developer sub-items
  const visibleSubItems = mode === "customer" ? [] : subItems;

  return (
    <aside className={cn(
      "flex flex-col shrink-0 border-r border-border/30 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 transition-all duration-300",
      collapsed ? "w-16" : "w-52 lg:w-64"
    )}>
      {/* Header + Collapse toggle */}
      <div className="flex items-center gap-2 px-3 h-16 border-b border-border/30 shrink-0">
        {!collapsed && (
          mode === "developer" ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
                <span className="text-lg font-bold gradient-text">Voice Agent</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/workflow")} className="cursor-pointer">
                  <WorkflowIcon className="h-4 w-4 mr-2" />
                  <span className="gradient-text font-semibold">Workflow</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-lg font-bold gradient-text">ISIBI</span>
          )
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleCollapse}
              className={cn(
                "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors",
                collapsed && "mx-auto"
              )}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Credit badge */}
      {balance !== null && balance !== undefined && (
        <div className={cn("mx-2 mt-4 mb-2", collapsed && "mx-1")}>
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-3 text-sm",
            collapsed && "justify-center px-2",
            lowBalance
              ? "bg-warning/10 border border-warning/20 text-warning"
              : "bg-primary/5 border border-primary/10 text-primary"
          )}>
            <CreditCard className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="font-semibold">${balance.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground ml-auto">credits</span>
              </>
            )}
          </div>
          {/* Flat-rate indicator for customer mode */}
          {mode === "customer" && !collapsed && (
            <p className="text-xs text-muted-foreground text-center mt-1.5">$0.20/min flat rate</p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const children = visibleSubItems.filter((s) => s.parent === item.id);
          return (
            <div key={item.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                      collapsed && "justify-center px-2",
                      activeTab === item.id
                        ? "bg-primary/10 text-primary border border-primary/15"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
              {children.length > 0 && !collapsed && (
                <div className="ml-4 mt-1 space-y-1">
                  {children.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => onTabChange(sub.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                        activeTab === sub.id
                          ? "bg-primary/10 text-primary border border-primary/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                    >
                      <sub.icon className="h-3.5 w-3.5 shrink-0" />
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/30 p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("account_type"); navigate(mode === "customer" ? "/customer-login" : "/"); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                collapsed && "justify-center px-2"
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && "Log Out"}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">Log Out</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
