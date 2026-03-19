import { useState, useRef, useEffect } from "react";
import { leadsChat, ProspectLead } from "../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; leads?: ProspectLead[]; total?: number; prompt?: string };

function exportPDF(leads: ProspectLead[], prompt: string) {
  const doc = new jsPDF();
  doc.setFontSize(13);
  doc.text("Leads Report", 14, 16);
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(`"${prompt}" · ${new Date().toLocaleString()}`, 14, 23);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 28,
    head: [["Name", "Phone", "Email", "Location", "Score"]],
    body: leads.map(l => [
      l.full_name || "—",
      l.phone || "—",
      l.email || "—",
      [l.city, l.state].filter(Boolean).join(", ") || "—",
      String(l.score ?? 0),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [99, 102, 241] },
  });
  doc.save(`leads-${Date.now()}.pdf`);
}

const SUGGESTIONS = [
  "Show me my top leads",
  "Find homeowners in Florida",
  "Business owners with score above 70",
  "New leads I haven't contacted",
];

export default function LeadsAgent() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);
    setMessages(prev => [...prev, { role: "user", text: msg }]);

    try {
      const res = await leadsChat(msg);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          text: res.reply,
          leads: res.action === "search" ? res.leads : undefined,
          total: res.total,
          prompt: msg,
        },
      ]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `Something went wrong: ${e.message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d0f17] text-white">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (

          /* Empty / welcome state */
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-8">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 text-xl">🎯</div>
              <h1 className="text-2xl font-semibold text-white mb-2">Leads Intelligence</h1>
              <p className="text-slate-400 text-sm max-w-sm">Ask me to find, filter, or analyze your leads. I'll search your database and hand you a PDF.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="px-4 py-3 text-sm text-slate-300 bg-slate-800/60 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl text-left transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>

        ) : (

          <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">AI</div>
                )}

                <div className={`max-w-[85%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>

                  {/* Bubble */}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-slate-800 text-slate-200 rounded-tl-sm"
                  }`}>
                    {msg.text}
                    {msg.role === "assistant" && msg.total != null && msg.leads && msg.leads.length > 0 && (
                      <span className="text-slate-400 text-xs ml-2">({msg.total} found)</span>
                    )}
                  </div>

                  {/* PDF download card */}
                  {msg.role === "assistant" && msg.leads && msg.leads.length > 0 && (
                    <button
                      onClick={() => exportPDF(msg.leads!, msg.prompt!)}
                      className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500 rounded-xl transition-all group w-full text-left">
                      <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 group-hover:bg-indigo-600/30 transition-colors">
                        ⬇
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Download PDF</p>
                        <p className="text-xs text-slate-400">{msg.leads.length} lead{msg.leads.length !== 1 ? "s" : ""} · click to download</p>
                      </div>
                    </button>
                  )}

                  {/* No results */}
                  {msg.role === "assistant" && msg.leads && msg.leads.length === 0 && (
                    <p className="text-xs text-slate-500 px-1">No leads matched. Try importing a CSV first.</p>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">You</div>
                )}
              </div>
            ))}

            {/* Thinking */}
            {busy && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <div className="flex-1 bg-slate-800 border border-slate-700 focus-within:border-indigo-500 rounded-2xl px-4 py-3 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message Leads AI…"
              rows={1}
              disabled={busy}
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
              style={{ maxHeight: 120, overflowY: "auto" }}
            />
          </div>
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || busy}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>

    </div>
  );
}
