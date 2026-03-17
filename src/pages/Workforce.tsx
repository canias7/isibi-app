import TeamTableBuilder from "@/components/TeamTableBuilder";

export default function Workforce() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <span className="text-indigo-400 text-xs font-bold">AI</span>
          </div>
          <span className="text-sm font-semibold text-white/80">Workforce</span>
        </div>
        <a href="/dashboard" className="text-xs text-white/30 hover:text-white/60 transition-colors">
          ← Back to Dashboard
        </a>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <TeamTableBuilder
          className="w-full max-w-3xl"
          onSeatClick={(seat) => console.log("Seat clicked:", seat)}
          onAddAgent={(seat) => console.log("Add agent to:", seat.position)}
        />
      </div>
    </div>
  );
}
