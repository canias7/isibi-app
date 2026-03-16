import { useNavigate } from "react-router-dom";
import { Bot, Phone, Plus, Settings, Users, BrainCircuit, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  // Read CRM prompts count from localStorage
  let crmCount = 0;
  try {
    const raw = localStorage.getItem("crm_prompts");
    if (raw) {
      const parsed = JSON.parse(raw);
      crmCount = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch {
    crmCount = 0;
  }

  const goToAssistant = () => {
    onNavigate?.("assistant");
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Employees</h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI workforce</p>
      </div>

      {/* Employee Grid */}
      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">No employees yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first AI voice employee to get started.</p>
          </div>
          <Button onClick={goToAssistant} className="mt-2">
            <Plus className="h-4 w-4 mr-2" />
            New Employee
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="group rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 flex flex-col gap-4 hover:border-primary/30 transition-all duration-200"
            >
              {/* Top row: icon + name + badge */}
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/10 shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {agent.assistant_name || agent.name || "Unnamed Employee"}
                  </p>
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  >
                    Voice Employee
                  </Badge>
                </div>
              </div>

              {/* Phone number */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{agent.phone_number || "No number"}</span>
              </div>

              {/* Configure button */}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-auto"
                onClick={goToAssistant}
              >
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Configure
              </Button>
            </div>
          ))}

          {/* + New Employee card */}
          <button
            onClick={goToAssistant}
            className={cn(
              "rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-6",
              "flex flex-col items-center justify-center gap-3 text-center",
              "hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 cursor-pointer min-h-[180px]"
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/60 border border-border/40">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">New Employee</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add a voice AI employee</p>
            </div>
          </button>
        </div>
      )}

      {/* CRM Employees section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">CRM Employees</h2>
        </div>
        <div
          className={cn(
            "rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5",
            "flex items-center justify-between hover:border-primary/20 transition-colors"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">CRM Prompt Employees</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {crmCount} employee{crmCount !== 1 ? "s" : ""} configured
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/crm-agent")}
            className="gap-1.5 text-xs"
          >
            Manage
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
