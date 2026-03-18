import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, Phone, Plus, Settings, Users, BrainCircuit,
  Workflow as WorkflowIcon, Mic, ChevronDown, Target, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CRMPrompt {
  id: string;
  name: string;
  content: string;
  direction: "inbound" | "outbound";
  phoneNumber?: string;
  createdAt: string;
}

interface DashboardOverviewProps {
  balance?: number | null;
  lowBalance?: boolean;
  usage?: any;
  calls?: any[];
  agents: any[];
  transactions?: any[];
  onNavigate?: (tab: string) => void;
}

export default function DashboardOverview({ agents, onNavigate }: DashboardOverviewProps) {
  const navigate = useNavigate();
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Load CRM prompts from localStorage
  let crmPrompts: CRMPrompt[] = [];
  try {
    const raw = localStorage.getItem("crm_prompts");
    if (raw) {
      const parsed = JSON.parse(raw);
      crmPrompts = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    crmPrompts = [];
  }

  const totalEmployees = agents.length + crmPrompts.length;

  // ── Employee cards ──────────────────────────────────────────────────────────

  const voiceCards = agents.map((agent) => ({
    key: `voice-${agent.id}`,
    name: agent.assistant_name || agent.name || "Unnamed Employee",
    type: "Voice" as const,
    phone: agent.phone_number || null,
    onClick: () => onNavigate?.("assistant"),
    onConfigure: () => onNavigate?.("assistant"),
  }));

  const crmCards = crmPrompts.map((p) => ({
    key: `crm-${p.id}`,
    name: p.name || "Unnamed Employee",
    type: "CRM" as const,
    phone: p.phoneNumber || null,
    direction: p.direction,
    onClick: () => navigate("/crm-agent"),
    onConfigure: () => navigate("/crm-agent"),
  }));

  const allCards = [...voiceCards, ...crmCards];

  // ── Type badge ──────────────────────────────────────────────────────────────

  const typeBadge = (type: "Voice" | "CRM" | "Workflow") => {
    const styles = {
      Voice:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
      CRM:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
      Workflow: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
    const icons = { Voice: Mic, CRM: BrainCircuit, Workflow: WorkflowIcon };
    const Icon = icons[type];
    return (
      <Badge variant="secondary" className={cn("text-[10px] font-medium border gap-1 mt-1", styles[type])}>
        <Icon className="h-2.5 w-2.5" />
        {type} Employee
      </Badge>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Workforce</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalEmployees === 0
              ? "No AI employees yet — create your first one"
              : `${totalEmployees} AI employee${totalEmployees !== 1 ? "s" : ""} in your team`}
          </p>
        </div>

        {/* + New Employee button with dropdown */}
        <DropdownMenu open={showNewMenu} onOpenChange={setShowNewMenu}>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Employee
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => { setShowNewMenu(false); onNavigate?.("assistant"); }}
              className="cursor-pointer gap-3 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Mic className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Voice Employee</p>
                <p className="text-xs text-muted-foreground">AI phone agent</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { setShowNewMenu(false); navigate("/crm-agent"); }}
              className="cursor-pointer gap-3 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                <BrainCircuit className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium">CRM Employee</p>
                <p className="text-xs text-muted-foreground">Outbound &amp; inbound CRM</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { setShowNewMenu(false); navigate("/workflow"); }}
              className="cursor-pointer gap-3 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <WorkflowIcon className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Workflow</p>
                <p className="text-xs text-muted-foreground">Automated pipeline</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Employee grid ────────────────────────────────────────────── */}
      {allCards.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">No employees yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first AI employee — voice agent, CRM caller, or workflow.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="mt-2 gap-2">
                <Plus className="h-4 w-4" />
                Create First Employee
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onNavigate?.("assistant")} className="cursor-pointer gap-2">
                <Mic className="h-4 w-4 text-blue-400" /> Voice Employee
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/crm-agent")} className="cursor-pointer gap-2">
                <BrainCircuit className="h-4 w-4 text-violet-400" /> CRM Employee
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/workflow")} className="cursor-pointer gap-2">
                <WorkflowIcon className="h-4 w-4 text-emerald-400" /> Workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Existing employee cards */}
          {allCards.map((card) => (
            <div
              key={card.key}
              onClick={card.onClick}
              className="group rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 flex flex-col gap-4 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              {/* Icon + name + type */}
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border shrink-0",
                  card.type === "Voice"    && "bg-blue-500/10 border-blue-500/15",
                  card.type === "CRM"     && "bg-violet-500/10 border-violet-500/15",
                  card.type === "Workflow" && "bg-emerald-500/10 border-emerald-500/15",
                )}>
                  {card.type === "Voice"    && <Bot className="h-5 w-5 text-blue-400" />}
                  {card.type === "CRM"     && <BrainCircuit className="h-5 w-5 text-violet-400" />}
                  {card.type === "Workflow" && <WorkflowIcon className="h-5 w-5 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{card.name}</p>
                  {typeBadge(card.type)}
                  {"direction" in card && (
                    <Badge variant="outline" className="ml-1 mt-1 text-[10px] border-border/40 text-muted-foreground">
                      {(card as any).direction}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{card.phone || "No number assigned"}</span>
              </div>

              {/* Configure */}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-auto"
                onClick={e => { e.stopPropagation(); card.onConfigure(); }}
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Configure
              </Button>
            </div>
          ))}

          {/* + Add another employee card */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-6",
                  "flex flex-col items-center justify-center gap-3 text-center min-h-[180px]",
                  "hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                )}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/60 border border-border/40">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">New Employee</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Voice · CRM · Workflow</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onNavigate?.("assistant")} className="cursor-pointer gap-2">
                <Mic className="h-4 w-4 text-blue-400" /> Voice Employee
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/crm-agent")} className="cursor-pointer gap-2">
                <BrainCircuit className="h-4 w-4 text-violet-400" /> CRM Employee
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/workflow")} className="cursor-pointer gap-2">
                <WorkflowIcon className="h-4 w-4 text-emerald-400" /> Workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {/* ── Tools row ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              path: "/leads-agent",
              icon: Target,
              label: "Leads Agent",
              desc: "AI prospecting with Apollo.io",
              color: "from-orange-500/15 to-rose-500/10 border-orange-500/25",
              iconColor: "bg-orange-500/10 text-orange-400",
            },
            {
              path: "/accounting",
              icon: BrainCircuit,
              label: "Accounting",
              desc: "Invoices, expenses & P&L",
              color: "from-emerald-500/15 to-teal-500/10 border-emerald-500/25",
              iconColor: "bg-emerald-500/10 text-emerald-400",
            },
            {
              path: "/crm-agent",
              icon: Users,
              label: "CRM",
              desc: "Contacts, calls & pipeline",
              color: "from-violet-500/15 to-purple-500/10 border-violet-500/25",
              iconColor: "bg-violet-500/10 text-violet-400",
            },
          ].map(tool => (
            <button key={tool.path} onClick={() => navigate(tool.path)}
              className={cn(
                "rounded-2xl border bg-gradient-to-br p-4 text-left flex items-center gap-3",
                "hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 group",
                tool.color
              )}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", tool.iconColor)}>
                <tool.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{tool.label}</p>
                <p className="text-xs text-muted-foreground">{tool.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
