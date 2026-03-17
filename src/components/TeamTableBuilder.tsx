import { useState } from "react";
import { Plus, Zap, BrainCircuit, Phone, BarChart3, Mail, Workflow, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SeatId =
  | "top-1" | "top-2" | "top-3" | "top-4"
  | "bottom-1" | "bottom-2" | "bottom-3" | "bottom-4"
  | "left-1" | "right-1";

type SeatSide   = "top" | "bottom" | "left" | "right";
type AgentStatus = "online" | "offline" | "busy";

interface Seat {
  id: string;
  position: SeatId;
  occupied: boolean;
  name?: string;
  role?: string;
  status?: AgentStatus;
  icon?: React.ElementType;
  color?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT MATH
//
// Scene container: aspect-ratio 800 × 480 (5:3) → padding-bottom: 60%
//
// Table rect (% of container):
//   left: 17%  right: 83%  top: 14%  bottom: 86%
//   width: 66%  height: 72%
//
// Seat avatar centres (% of container):
//
//   Top row    y = 7%    — avatar touches table top edge (14%) from above
//   Bottom row y = 93%   — avatar touches table bottom edge (86%) from below
//   Left       x = 8.5%  — avatar touches table left edge (17%) from left
//   Right      x = 91.5% — avatar touches table right edge (83%) from right
//
//   Top/bottom x spread: table spans 17%–83%. Inner padding 8% each side.
//   Usable range 25%–75% = 50% for 4 seats (3 gaps of 16.67%)
//   → 25%  41.5%  58.5%  75%   (symmetric around 50%)
// ─────────────────────────────────────────────────────────────────────────────

interface SeatCoord {
  x: number;   // % of scene width
  y: number;   // % of scene height
  side: SeatSide;
}

const COORDS: Record<SeatId, SeatCoord> = {
  "top-1":    { x: 25,   y: 7,  side: "top"    },
  "top-2":    { x: 41.5, y: 7,  side: "top"    },
  "top-3":    { x: 58.5, y: 7,  side: "top"    },
  "top-4":    { x: 75,   y: 7,  side: "top"    },
  "bottom-1": { x: 25,   y: 93, side: "bottom" },
  "bottom-2": { x: 41.5, y: 93, side: "bottom" },
  "bottom-3": { x: 58.5, y: 93, side: "bottom" },
  "bottom-4": { x: 75,   y: 93, side: "bottom" },
  "left-1":   { x: 8.5,  y: 50, side: "left"   },
  "right-1":  { x: 91.5, y: 50, side: "right"  },
};

// Avatar: 48px  ·  Chair base: 66px
// Label offset from avatar edge: 7px
// → label offset from center: 24 + 7 = 31px

const AVATAR_R  = 24;  // avatar radius (px)
const LABEL_GAP = 7;   // gap between avatar edge and label (px)
const LABEL_OFF = AVATAR_R + LABEL_GAP; // = 31px

/** Returns the inline style to position the label div relative to seat center. */
function labelStyle(side: SeatSide): React.CSSProperties {
  switch (side) {
    case "top":    return { bottom: LABEL_OFF, left: "50%", transform: "translateX(-50%)" };
    case "bottom": return { top:    LABEL_OFF, left: "50%", transform: "translateX(-50%)" };
    case "left":   return { right:  LABEL_OFF, top:  "50%", transform: "translateY(-50%)" };
    case "right":  return { left:   LABEL_OFF, top:  "50%", transform: "translateY(-50%)" };
  }
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  online:  "#22c55e",
  offline: "#6b7280",
  busy:    "#f59e0b",
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_SEATS: Seat[] = [
  { id:"s1",  position:"top-1",    occupied:true,  name:"VoiceBot",   role:"AI Voice Agent",     status:"online",  icon:Phone,        color:"#6366f1" },
  { id:"s2",  position:"top-2",    occupied:true,  name:"LeadGen AI", role:"Lead Generation",    status:"online",  icon:Zap,          color:"#22c55e" },
  { id:"s3",  position:"top-3",    occupied:true,  name:"Aria",       role:"CRM Manager",        status:"busy",    icon:BrainCircuit, color:"#f59e0b" },
  { id:"s4",  position:"top-4",    occupied:false },
  { id:"s5",  position:"bottom-1", occupied:true,  name:"EmailBot",   role:"Email Marketing",    status:"online",  icon:Mail,         color:"#06b6d4" },
  { id:"s6",  position:"bottom-2", occupied:false },
  { id:"s7",  position:"bottom-3", occupied:true,  name:"FlowBot",    role:"Workflow Agent",     status:"online",  icon:Workflow,     color:"#a855f7" },
  { id:"s8",  position:"bottom-4", occupied:false },
  { id:"s9",  position:"left-1",   occupied:true,  name:"DataAgent",  role:"Analytics & Reports",status:"busy",    icon:BarChart3,    color:"#ef4444" },
  { id:"s10", position:"right-1",  occupied:false },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEAT NODE — single seat rendered at its exact coordinate
// ─────────────────────────────────────────────────────────────────────────────

function SeatNode({
  seat,
  selected,
  onOccupied,
  onEmpty,
}: {
  seat: Seat;
  selected: boolean;
  onOccupied: () => void;
  onEmpty: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const coord = COORDS[seat.position];
  const Icon  = seat.icon ?? Bot;
  const color = seat.color ?? "#6366f1";

  return (
    <div
      className="absolute"
      style={{
        left:      `${coord.x}%`,
        top:       `${coord.y}%`,
        transform: "translate(-50%, -50%)",
        width:     66,
        height:    66,
        cursor:    "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={seat.occupied ? onOccupied : onEmpty}
    >
      {/* ── Chair base (visible seat surface, top-down view) ── */}
      <div
        style={{
          position:     "absolute",
          inset:        0,
          borderRadius: "50%",
          background:   "radial-gradient(circle at 40% 35%, #2a2a2a, #161616)",
          border:       `1px solid ${seat.occupied && selected ? color + "60" : "rgba(255,255,255,0.07)"}`,
          boxShadow:    "inset 0 3px 8px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)",
          transition:   "border-color 0.2s",
        }}
      />

      {/* ── Occupied: avatar ── */}
      {seat.occupied && (
        <>
          {/* Glow halo */}
          <div
            style={{
              position:        "absolute",
              top:             "50%", left: "50%",
              transform:       "translate(-50%, -50%)",
              width:           48, height: 48,
              borderRadius:    "50%",
              background:      color,
              filter:          "blur(10px)",
              opacity:         selected ? 0.55 : hovered ? 0.35 : 0.18,
              transition:      "opacity 0.25s",
              pointerEvents:   "none",
            }}
          />

          {/* Avatar circle */}
          <div
            style={{
              position:     "absolute",
              top: "50%", left: "50%",
              transform:    "translate(-50%, -50%)",
              width:        48, height: 48,
              borderRadius: "50%",
              background:   `linear-gradient(145deg, ${color}28, ${color}48)`,
              border:       `1.5px solid ${selected ? color : hovered ? color + "80" : "rgba(255,255,255,0.12)"}`,
              boxShadow:    selected ? `0 0 0 2.5px ${color}55` : "none",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              transition:   "border-color 0.2s, box-shadow 0.2s",
              scale:        selected || hovered ? "1.07" : "1",
              zIndex:       2,
            }}
          >
            <Icon style={{ width: 18, height: 18, color }} />
          </div>

          {/* Status dot */}
          <div
            style={{
              position:     "absolute",
              bottom:       8, right: 8,
              width:        10, height: 10,
              borderRadius: "50%",
              background:   STATUS_COLOR[seat.status ?? "offline"],
              border:       "2px solid #0d0d0d",
              zIndex:       3,
            }}
          />

          {/* Label — always on outer side (away from table) */}
          <div
            style={{
              position:   "absolute",
              ...labelStyle(coord.side),
              textAlign:  coord.side === "left"  ? "right"
                        : coord.side === "right" ? "left"
                        : "center",
              whiteSpace: "nowrap",
              zIndex:     4,
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.88)", lineHeight: 1.2 }}>
              {seat.name}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>
              {seat.role}
            </div>
          </div>

          {/* Tooltip */}
          {hovered && (
            <div
              style={{
                position:    "absolute",
                bottom:      "calc(100% + 10px)",
                left:        "50%",
                transform:   "translateX(-50%)",
                padding:     "5px 9px",
                borderRadius: 8,
                background:  "#1c1c1c",
                border:      "1px solid rgba(255,255,255,0.1)",
                fontSize:    11,
                color:       "rgba(255,255,255,0.8)",
                whiteSpace:  "nowrap",
                zIndex:      50,
                boxShadow:   "0 4px 16px rgba(0,0,0,0.6)",
                pointerEvents: "none",
              }}
            >
              {seat.name} · <span style={{ color: STATUS_COLOR[seat.status ?? "offline"] }}>{seat.status}</span>
            </div>
          )}
        </>
      )}

      {/* ── Empty: plus button ── */}
      {!seat.occupied && (
        <>
          {/* Pulse ring */}
          <div
            style={{
              position:     "absolute",
              inset:        4,
              borderRadius: "50%",
              border:       "1px solid rgba(255,255,255,0.06)",
              animation:    "ping 2.4s cubic-bezier(0,0,0.2,1) infinite",
              opacity:      hovered ? 0.4 : 0.15,
            }}
          />

          {/* Plus button — same 48px as occupied avatar */}
          <div
            style={{
              position:     "absolute",
              top: "50%", left: "50%",
              transform:    "translate(-50%, -50%)",
              width:        48, height: 48,
              borderRadius: "50%",
              background:   hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
              border:       `1.5px dashed ${hovered ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              transition:   "all 0.2s",
              scale:        hovered ? "1.08" : "1",
              zIndex:       2,
            }}
          >
            <Plus
              style={{
                width:  16, height: 16,
                color:  hovered ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
                transition: "color 0.2s",
              }}
              strokeWidth={2}
            />
          </div>

          {/* Add agent tooltip */}
          {hovered && (
            <div
              style={{
                position:    "absolute",
                bottom:      "calc(100% + 10px)",
                left:        "50%",
                transform:   "translateX(-50%)",
                padding:     "5px 9px",
                borderRadius: 8,
                background:  "#1c1c1c",
                border:      "1px solid rgba(255,255,255,0.1)",
                fontSize:    11,
                color:       "rgba(255,255,255,0.6)",
                whiteSpace:  "nowrap",
                zIndex:      50,
                boxShadow:   "0 4px 16px rgba(0,0,0,0.6)",
                pointerEvents: "none",
              }}
            >
              + Add AI Agent
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface TeamTableBuilderProps {
  onSeatClick?: (seat: Seat) => void;
  onAddAgent?:  (seat: Seat) => void;
  className?:   string;
}

export default function TeamTableBuilder({ onSeatClick, onAddAgent, className }: TeamTableBuilderProps) {
  const [seats]    = useState<Seat[]>(INITIAL_SEATS);
  const [selected, setSelected] = useState<string | null>(null);

  const handleOccupied = (seat: Seat) => {
    setSelected(prev => prev === seat.id ? null : seat.id);
    onSeatClick?.(seat);
  };

  const onlineCount = seats.filter(s => s.occupied && s.status === "online").length;
  const busyCount   = seats.filter(s => s.occupied && s.status === "busy").length;
  const emptyCount  = seats.filter(s => !s.occupied).length;
  const selectedSeat = seats.find(s => s.id === selected);

  return (
    <div className={cn("flex flex-col items-center gap-6 w-full select-none", className)}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between w-full max-w-3xl">
        <div>
          <h2 className="text-[15px] font-bold text-white tracking-tight">AI Team Builder</h2>
          <p className="text-[11px] text-white/35 mt-0.5">Manage and deploy your AI workforce</p>
        </div>
        <div className="flex items-center gap-4">
          {[
            { color: "#22c55e", label: `${onlineCount} online` },
            { color: "#f59e0b", label: `${busyCount} busy`   },
            { color: "rgba(255,255,255,0.18)", label: `${emptyCount} open` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
              <span className="text-[11px] text-white/45">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scene ── */}
      {/*
          Padding-bottom: 60% gives us a 5:3 aspect-ratio container.
          Every child is absolute inside it, positioned with % coords defined above.
      */}
      <div
        className="relative w-full max-w-3xl"
        style={{ paddingBottom: "60%" }}
      >

        {/* ── Conference table ── */}
        <div
          className="absolute"
          style={{
            left:         "17%", top:    "14%",
            right:        "17%", bottom: "14%",
            borderRadius: "2.8rem",
            background:   "linear-gradient(160deg, #1d1d1d 0%, #141414 50%, #0f0f0f 100%)",
            border:       "1px solid rgba(255,255,255,0.055)",
            boxShadow:    "inset 0 4px 40px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.03), 0 8px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* Subtle grain texture via radial gradient rings */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "inherit",
            background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />

          {/* Centre emblem */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.09)",
              }} />
            </div>
          </div>

          {/* Hairline cross */}
          <div style={{ position:"absolute", top:"50%", left:"8%", right:"8%", height:1, background:"rgba(255,255,255,0.03)", transform:"translateY(-50%)" }} />
          <div style={{ position:"absolute", left:"50%", top:"8%", bottom:"8%", width:1, background:"rgba(255,255,255,0.03)", transform:"translateX(-50%)" }} />
        </div>

        {/* ── Seats ── */}
        {seats.map(seat => (
          <SeatNode
            key={seat.id}
            seat={seat}
            selected={selected === seat.id}
            onOccupied={() => handleOccupied(seat)}
            onEmpty={() => onAddAgent?.(seat)}
          />
        ))}
      </div>

      {/* ── Selected agent panel ── */}
      <div
        style={{
          width:      "100%",
          maxWidth:   768,
          height:     selected ? 68 : 0,
          overflow:   "hidden",
          transition: "height 0.25s ease",
        }}
      >
        {selectedSeat?.occupied && (() => {
          const Icon  = selectedSeat.icon ?? Bot;
          const color = selectedSeat.color ?? "#6366f1";
          return (
            <div
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          14,
                padding:      "12px 18px",
                borderRadius: 16,
                background:   "rgba(255,255,255,0.025)",
                border:       "1px solid rgba(255,255,255,0.08)",
                boxShadow:    `0 0 24px ${color}12`,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `${color}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon style={{ width: 17, height: 17, color }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                    {selectedSeat.name}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    padding: "2px 7px", borderRadius: 20,
                    color: STATUS_COLOR[selectedSeat.status ?? "offline"],
                    background: `${STATUS_COLOR[selectedSeat.status ?? "offline"]}15`,
                    border: `1px solid ${STATUS_COLOR[selectedSeat.status ?? "offline"]}35`,
                  }}>
                    {selectedSeat.status}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  {selectedSeat.role} · seat {selectedSeat.position}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                style={{
                  fontSize: 11, color: "rgba(255,255,255,0.3)",
                  padding: "5px 12px", borderRadius: 8,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}
              >
                Dismiss
              </button>
            </div>
          );
        })()}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
