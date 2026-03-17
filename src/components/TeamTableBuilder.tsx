import { useState } from "react";
import { Plus, Zap, BrainCircuit, Phone, MessageSquare, BarChart3, Mail, Globe, Bot, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type SeatPosition =
  | "top-1" | "top-2" | "top-3" | "top-4"
  | "bottom-1" | "bottom-2" | "bottom-3" | "bottom-4"
  | "left-1" | "right-1";

type AgentStatus = "online" | "offline" | "busy";

interface Seat {
  id: string;
  position: SeatPosition;
  occupied: boolean;
  name?: string;
  role?: string;
  status?: AgentStatus;
  icon?: React.ElementType;
  color?: string;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const INITIAL_SEATS: Seat[] = [
  { id: "s1",  position: "top-1",    occupied: true,  name: "VoiceBot",    role: "AI Voice Agent",    status: "online",  icon: Phone,         color: "#6366f1" },
  { id: "s2",  position: "top-2",    occupied: true,  name: "Leadgen AI",  role: "Lead Generation",   status: "online",  icon: Zap,           color: "#22c55e" },
  { id: "s3",  position: "top-3",    occupied: true,  name: "Aria",        role: "CRM Manager",       status: "busy",    icon: BrainCircuit,  color: "#f59e0b" },
  { id: "s4",  position: "top-4",    occupied: false },
  { id: "s5",  position: "bottom-1", occupied: true,  name: "EmailBot",    role: "Email Marketing",   status: "online",  icon: Mail,          color: "#06b6d4" },
  { id: "s6",  position: "bottom-2", occupied: false },
  { id: "s7",  position: "bottom-3", occupied: true,  name: "FlowBot",     role: "Workflow Agent",    status: "online",  icon: Workflow,      color: "#a855f7" },
  { id: "s8",  position: "bottom-4", occupied: false },
  { id: "s9",  position: "left-1",   occupied: true,  name: "DataAgent",   role: "Analytics & Reports", status: "busy",  icon: BarChart3,     color: "#ef4444" },
  { id: "s10", position: "right-1",  occupied: false },
];

// ── Seat position layout config ───────────────────────────────────────────────
// Values are [top%, left%] percentages within the container

const POSITION_COORDS: Record<SeatPosition, { top: string; left: string; labelAbove: boolean }> = {
  "top-1":    { top: "3%",   left: "22%",  labelAbove: false },
  "top-2":    { top: "3%",   left: "38%",  labelAbove: false },
  "top-3":    { top: "3%",   left: "54%",  labelAbove: false },
  "top-4":    { top: "3%",   left: "70%",  labelAbove: false },
  "bottom-1": { top: "74%",  left: "22%",  labelAbove: true  },
  "bottom-2": { top: "74%",  left: "38%",  labelAbove: true  },
  "bottom-3": { top: "74%",  left: "54%",  labelAbove: true  },
  "bottom-4": { top: "74%",  left: "70%",  labelAbove: true  },
  "left-1":   { top: "36%",  left: "3%",   labelAbove: false },
  "right-1":  { top: "36%",  left: "88%",  labelAbove: false },
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  online: "#22c55e",
  offline: "#6b7280",
  busy:   "#f59e0b",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs text-white whitespace-nowrap z-50 shadow-xl pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </div>
      )}
    </div>
  );
}

function OccupiedSeat({
  seat, selected, onClick,
}: { seat: Seat; selected: boolean; onClick: () => void }) {
  const Icon = seat.icon ?? Bot;
  const color = seat.color ?? "#6366f1";
  const coords = POSITION_COORDS[seat.position];

  return (
    <div
      className="absolute flex flex-col items-center gap-1.5 cursor-pointer group"
      style={{ top: coords.top, left: coords.left, transform: "translate(-50%, 0)" }}
      onClick={onClick}
    >
      {/* Label above */}
      {coords.labelAbove && (
        <div className="flex flex-col items-center mb-0.5 order-first">
          <span className="text-[11px] font-semibold text-white/90 leading-tight whitespace-nowrap">{seat.name}</span>
          <span className="text-[9px] text-white/40 whitespace-nowrap">{seat.role}</span>
        </div>
      )}

      {/* Avatar ring */}
      <Tooltip text={`${seat.name} · ${seat.status}`}>
        <div className="relative">
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-300"
            style={{ backgroundColor: color }}
          />
          {/* Outer ring */}
          <div
            className={cn(
              "relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
              selected ? "ring-2 ring-offset-2 ring-offset-transparent scale-110" : "ring-1 ring-white/10 group-hover:ring-white/30 group-hover:scale-105"
            )}
            style={{
              background: `linear-gradient(135deg, ${color}22, ${color}44)`,
              boxShadow: selected ? `0 0 0 2px ${color}` : undefined,
            }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          {/* Status dot */}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950"
            style={{ backgroundColor: STATUS_COLORS[seat.status ?? "offline"] }}
          />
        </div>
      </Tooltip>

      {/* Label below */}
      {!coords.labelAbove && (
        <div className="flex flex-col items-center mt-0.5">
          <span className="text-[11px] font-semibold text-white/90 leading-tight whitespace-nowrap">{seat.name}</span>
          <span className="text-[9px] text-white/40 whitespace-nowrap">{seat.role}</span>
        </div>
      )}
    </div>
  );
}

function EmptySeat({
  seat, onClick,
}: { seat: Seat; onClick: () => void }) {
  const coords = POSITION_COORDS[seat.position];
  return (
    <div
      className="absolute flex items-center justify-center cursor-pointer group"
      style={{ top: coords.top, left: coords.left, transform: "translate(-50%, 14px)" }}
      onClick={onClick}
    >
      <Tooltip text="Add AI Agent">
        <div className="relative">
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white scale-110 group-hover:opacity-30" />
          {/* Button */}
          <div className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-white/10 bg-white/5 border border-white/10 group-hover:border-white/30 shadow-inner">
            <Plus className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" strokeWidth={2} />
          </div>
        </div>
      </Tooltip>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface TeamTableBuilderProps {
  onSeatClick?: (seat: Seat) => void;
  onAddAgent?: (seat: Seat) => void;
  className?: string;
}

export default function TeamTableBuilder({
  onSeatClick,
  onAddAgent,
  className,
}: TeamTableBuilderProps) {
  const [seats] = useState<Seat[]>(INITIAL_SEATS);
  const [selected, setSelected] = useState<string | null>(null);

  const handleOccupied = (seat: Seat) => {
    setSelected(prev => prev === seat.id ? null : seat.id);
    onSeatClick?.(seat);
  };

  const handleEmpty = (seat: Seat) => {
    onAddAgent?.(seat);
  };

  const onlineCount = seats.filter(s => s.occupied && s.status === "online").length;
  const busyCount   = seats.filter(s => s.occupied && s.status === "busy").length;
  const emptyCount  = seats.filter(s => !s.occupied).length;

  return (
    <div className={cn("flex flex-col items-center gap-6 w-full select-none", className)}>

      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-3xl px-1">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">AI Team Builder</h2>
          <p className="text-xs text-white/40 mt-0.5">Manage and deploy your AI workforce</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-white/50">{onlineCount} online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-white/50">{busyCount} busy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white/20" />
            <span className="text-xs text-white/50">{emptyCount} open</span>
          </div>
        </div>
      </div>

      {/* Scene */}
      <div className="relative w-full max-w-3xl" style={{ paddingBottom: "62%" }}>

        {/* Table */}
        <div
          className="absolute rounded-[2.5rem] border border-white/[0.06]"
          style={{
            top: "14%", left: "14%", right: "14%", bottom: "14%",
            background: "linear-gradient(160deg, #1a1a1a 0%, #111111 60%, #0d0d0d 100%)",
            boxShadow: "inset 0 2px 40px rgba(0,0,0,0.6), 0 0 60px rgba(0,0,0,0.4)",
          }}
        >
          {/* Inner glow rim */}
          <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
            style={{ boxShadow: "inset 0 0 1px 1px rgba(255,255,255,0.04)" }} />

          {/* Center mark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/[0.06] flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
          </div>

          {/* Horizontal line */}
          <div className="absolute top-1/2 left-[12%] right-[12%] h-px bg-white/[0.04] -translate-y-1/2" />
          {/* Vertical line */}
          <div className="absolute left-1/2 top-[12%] bottom-[12%] w-px bg-white/[0.04] -translate-x-1/2" />
        </div>

        {/* Seats */}
        {seats.map(seat =>
          seat.occupied ? (
            <OccupiedSeat
              key={seat.id}
              seat={seat}
              selected={selected === seat.id}
              onClick={() => handleOccupied(seat)}
            />
          ) : (
            <EmptySeat
              key={seat.id}
              seat={seat}
              onClick={() => handleEmpty(seat)}
            />
          )
        )}
      </div>

      {/* Selected agent card */}
      {selected && (() => {
        const s = seats.find(x => x.id === selected);
        if (!s || !s.occupied) return null;
        const Icon = s.icon ?? Bot;
        return (
          <div
            className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4 transition-all duration-300"
            style={{ boxShadow: `0 0 30px ${s.color}18` }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${s.color}22` }}>
              <Icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{s.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border"
                  style={{
                    color: STATUS_COLORS[s.status ?? "offline"],
                    borderColor: `${STATUS_COLORS[s.status ?? "offline"]}40`,
                    background: `${STATUS_COLORS[s.status ?? "offline"]}10`,
                  }}>
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">{s.role} · Seat {s.position}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Dismiss
            </button>
          </div>
        );
      })()}
    </div>
  );
}
