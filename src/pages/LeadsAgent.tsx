import { useState, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { leadsChat, ProspectLead } from "../lib/api";

// ─── PDF export ───────────────────────────────────────────────────────────────

function exportPDF(leads: ProspectLead[], prompt: string) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Leads Intelligence Report", 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Search: "${prompt}"`, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 37,
    head: [["Name", "Phone", "Email", "Location", "Score", "Top Signal"]],
    body: leads.map(l => [
      l.full_name || "—",
      l.phone || "—",
      l.email || "—",
      [l.city, l.state].filter(Boolean).join(", ") || "—",
      String(l.score ?? 0),
      (l.score_reasons || [])[0] || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });

  doc.save(`leads-${Date.now()}.pdf`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Msg =
  | { role: "user"; text: string }
  | { role: "thinking" }
  | { role: "result"; text: string; leads: ProspectLead[]; total: number; prompt: string }
  | { role: "answer"; text: string };

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Find homeowners in Florida with high income",
  "Show me business owners with score above 70",
  "Find new leads I haven't contacted yet",
  "Show leads with home value over $500,000",
  "Top 10 highest scoring leads",
  "Find leads in Texas or California",
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LeadsAgent() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);
    setMessages(m => [...m, { role: "user", text: msg }, { role: "thinking" }]);
    scrollBottom();

    try {
      const res = await leadsChat(msg);
      setMessages(m => {
        const clean = m.filter(x => x.role !== "thinking");
        if (res.action === "search") {
          return [...clean, { role: "result", text: res.reply, leads: res.leads, total: res.total, prompt: msg }];
        }
        return [...clean, { role: "answer", text: res.reply }];
      });
    } catch (e: any) {
      setMessages(m => [...m.filter(x => x.role !== "thinking"), { role: "answer", text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
      scrollBottom();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [busy]);

  return (
    <div className="h-screen flex flex-col bg-[#0e1117] text-white">

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white">Leads Intelligence</h1>
        <p className="text-xs text-slate-500">Describe who you're looking for — AI will search and download a PDF</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg">
              🎯
            </div>
            <div>
              <p className="text-xl font-bold text-white mb-2">Find Your Best Leads</p>
              <p className="text-sm text-slate-400 max-w-md">
                Describe who you're looking for in plain English. I'll search your leads database and hand you a PDF ready to work from.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-4 py-3 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 hover:border-indigo-500/50 rounded-xl text-sm text-slate-300 hover:text-white transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[70%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                    {msg.text}
                  </div>
                </div>
              );
            }

            if (msg.role === "thinking") {
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
                  <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-1.5">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              );
            }

            if (msg.role === "answer") {
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
                  <div className="max-w-[75%] bg-slate-800/70 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              );
            }

            if (msg.role === "result") {
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">AI</div>
                  <div className="flex-1 max-w-[80%] space-y-3">
                    {/* AI reply text */}
                    <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200">
                      {msg.text}
                      {msg.total > 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                          ({msg.total} lead{msg.total !== 1 ? "s" : ""} found)
                        </span>
                      )}
                    </div>

                    {/* Result card */}
                    {msg.leads.length > 0 ? (
                      <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                        {/* Preview table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700">
                                {["Name","Phone","Email","Location","Score"].map(h => (
                                  <th key={h} className="text-left py-2 pr-4 text-slate-400 font-medium whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.leads.slice(0, 5).map(l => (
                                <tr key={l.id} className="border-b border-slate-800/60">
                                  <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{l.full_name || "—"}</td>
                                  <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{l.phone || "—"}</td>
                                  <td className="py-2 pr-4 text-slate-400 truncate max-w-[140px]">{l.email || "—"}</td>
                                  <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{[l.city, l.state].filter(Boolean).join(", ") || "—"}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`font-bold ${(l.score || 0) >= 80 ? "text-emerald-400" : (l.score || 0) >= 60 ? "text-yellow-400" : "text-orange-400"}`}>
                                      {l.score ?? 0}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {msg.leads.length > 5 && (
                            <p className="text-xs text-slate-500 mt-2 text-center">
                              +{msg.leads.length - 5} more in the PDF
                            </p>
                          )}
                        </div>

                        {/* Download button */}
                        <button
                          onClick={() => exportPDF(msg.leads, msg.prompt)}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                          ⬇ Download PDF ({msg.leads.length} lead{msg.leads.length !== 1 ? "s" : ""})
                        </button>
                      </div>
                    ) : (
                      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 text-sm text-slate-400">
                        No leads matched. Try importing a CSV first or broaden your search.
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2">
        <div className={`flex items-center gap-3 bg-slate-800/80 border rounded-2xl px-4 py-3 transition-colors ${busy ? "border-slate-700" : "border-slate-700 hover:border-slate-500 focus-within:border-indigo-500"}`}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="e.g. Find homeowners in Miami with score above 70…"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            disabled={busy}
            autoFocus
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || busy}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all flex-shrink-0">
            {busy
              ? <span className="animate-spin text-sm">⟳</span>
              : <span className="text-base leading-none">↑</span>
            }
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">
          AI searches your leads database · Results download as PDF
        </p>
      </div>
    </div>
  );
}
