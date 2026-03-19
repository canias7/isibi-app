import { useState, useRef, useCallback, useEffect } from "react";
import {
  ProspectLead, LeadFilters, SavedSearch,
  addLead, updateLead, getLead,
  addLeadNote, generateAISummary, generateLeadOutreach, logOutreachEvent,
  sendProspectSMS, callProspect, importLeadsCSV, getSavedSearches,
  saveSearch, deleteSavedSearch, leadsChat,
} from "../lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : s >= 40 ? "text-orange-400" : "text-slate-400";

const scoreBg = (s: number) =>
  s >= 80 ? "bg-emerald-500/20 border-emerald-500/40"
  : s >= 60 ? "bg-yellow-500/20 border-yellow-500/40"
  : s >= 40 ? "bg-orange-500/20 border-orange-500/40"
  : "bg-slate-700/40 border-slate-600/40";

const statusColors: Record<string, string> = {
  new:       "bg-blue-500/20 text-blue-300 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  qualified: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  converted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  dead:      "bg-slate-700/40 text-slate-500 border-slate-600/30",
};

const fmt = (n?: number) => n ? `$${n.toLocaleString()}` : "—";
const initials = (name?: string) =>
  (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

// ─── Chat message types ───────────────────────────────────────────────────────

type ChatMsg =
  | { role: "user"; text: string }
  | { role: "thinking" }
  | { role: "answer"; text: string }
  | { role: "results"; text: string; leads: ProspectLead[]; total: number; filters?: LeadFilters };

// ─── OutreachModal ─────────────────────────────────────────────────────────────

function OutreachModal({ lead, onClose, onLogged }: {
  lead: ProspectLead; onClose: () => void; onLogged: () => void;
}) {
  const [tab, setTab]         = useState<"sms"|"email"|"call">("sms");
  const [context, setContext] = useState("");
  const [msg, setMsg]         = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const generate = async () => {
    setLoading(true); setMsg(""); setSubject("");
    try {
      const res = await generateLeadOutreach(lead.id!, tab, context);
      if (tab === "email") { setSubject(res.subject || ""); setMsg(res.body || ""); }
      else setMsg(res.message || "");
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      if (tab === "sms")  await sendProspectSMS(lead.phone!, msg);
      if (tab === "call") await callProspect(lead.phone!, lead.full_name || "");
      await logOutreachEvent(lead.id!, { channel: tab, content: tab === "email" ? `${subject}\n\n${msg}` : msg });
      setSent(true); onLogged();
      setTimeout(() => { setSent(false); onClose(); }, 1500);
    } catch (e: any) { alert(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <p className="font-semibold text-white">Reach Out</p>
            <p className="text-sm text-slate-400">{lead.full_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="flex border-b border-slate-700">
          {(["sms","email","call"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setMsg(""); setSubject(""); }}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                tab === t ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"
              }`}>
              {t === "sms" ? "📱 SMS" : t === "email" ? "✉️ Email" : "📞 Call Script"}
            </button>
          ))}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Context (optional)</label>
            <input value={context} onChange={e => setContext(e.target.value)}
              placeholder="e.g. following up on a referral…"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <button onClick={generate} disabled={loading}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {loading ? <><span className="animate-spin inline-block">⟳</span> Generating…</> : "✨ Generate with AI"}
          </button>
          {tab === "email" && msg && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 mb-2" />
            </div>
          )}
          {msg && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                {tab === "sms" ? `Message (${msg.length}/160)` : tab === "call" ? "Call Script" : "Email Body"}
              </label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={5}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" />
            </div>
          )}
          {msg && (
            <button onClick={send} disabled={sending}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 ${
                sent ? "bg-emerald-600 text-white" : "bg-white text-slate-900 hover:bg-slate-100"
              }`}>
              {sent ? "✓ Sent!" : sending ? "Sending…"
                : tab === "call" ? "📞 Start Call" : tab === "sms" ? "📱 Send SMS" : "✉️ Send Email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AddLeadModal ─────────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState<Partial<ProspectLead>>({ homeowner_status: "unknown", business_owner_flag: false });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ProspectLead, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name && !form.phone && !form.email) { alert("Add at least a name, phone, or email."); return; }
    setSaving(true);
    try { await addLead(form); onAdded(); onClose(); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const Field = ({ label, field, type = "text", placeholder = "", span = 1 }: any) => (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input type={type} value={(form as any)[field] || ""} onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700 sticky top-0 bg-[#1a1f2e]">
          <p className="font-semibold text-white">Add Lead Manually</p>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <Field label="Full Name"  field="full_name"  placeholder="John Doe" />
          <Field label="Phone"      field="phone"      placeholder="(305) 555-0100" />
          <Field label="Email"      field="email"      placeholder="john@example.com" />
          <Field label="City"       field="city"       placeholder="Miami" />
          <Field label="State"      field="state"      placeholder="FL" />
          <Field label="ZIP Code"   field="zip_code"   placeholder="33101" />
          <Field label="Address"    field="address"    placeholder="123 Main St" span={2} />
          <Field label="Estimated Home Value ($)" field="estimated_home_value" type="number" placeholder="500000" />
          <Field label="ZIP Median Income ($)"    field="zip_median_income"    type="number" placeholder="85000" />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Homeowner Status</label>
            <select value={form.homeowner_status} onChange={e => set("homeowner_status", e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="unknown">Unknown</option>
              <option value="owner">Owner</option>
              <option value="renter">Renter</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Business Owner?</label>
            <select value={form.business_owner_flag ? "yes" : "no"}
              onChange={e => set("business_owner_flag", e.target.value === "yes")}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <Field label="Lead Source" field="lead_source" placeholder="referral, event, website…" span={2} />
        </div>
        <div className="p-5 border-t border-slate-700 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
            {saving ? "Saving…" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ImportModal ───────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult]   = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [dragging, setDragging] = useState(false);

  const doImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const r = await importLeadsCSV(file);
      setResult(r);
      if (r.imported > 0) onImported();
    } catch (e: any) { alert(e.message); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <p className="font-semibold text-white">Import Leads from CSV</p>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setResult(null); } }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragging ? "border-indigo-500 bg-indigo-500/10" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/20"
            }`}>
            <p className="text-3xl mb-2">📂</p>
            <p className="text-white font-medium text-sm">{file ? file.name : "Drop CSV here or click to browse"}</p>
            <p className="text-xs text-slate-500 mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : ".csv files only"}</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setResult(null); } }} />
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/60">
            <p className="text-xs font-semibold text-slate-400 mb-2">Supported columns</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              full_name, phone, email, city, state, zip_code, address, estimated_home_value, zip_median_income, homeowner_status, business_owner_flag, lead_source
            </p>
          </div>

          {result ? (
            <div className={`rounded-xl p-3 border text-sm ${result.imported > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-slate-800 border-slate-700 text-slate-300"}`}>
              {result.imported > 0 ? `✓ ${result.imported} leads imported and scored` : "No leads imported"}
              {result.skipped > 0 && <span className="text-slate-400 ml-1">({result.skipped} skipped)</span>}
            </div>
          ) : (
            <button onClick={doImport} disabled={!file || importing}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors">
              {importing ? "⟳ Importing…" : "Import & Score Leads"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LeadDetailDrawer ──────────────────────────────────────────────────────────

function LeadDetailDrawer({ lead: initial, onClose, onUpdate }: {
  lead: ProspectLead; onClose: () => void; onUpdate: () => void;
}) {
  const [lead, setLead]         = useState(initial);
  const [aiLoading, setAiLoading] = useState(false);
  const [note, setNote]           = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [status, setStatus]       = useState(lead.status || "new");

  const refresh = async () => {
    if (!lead.id) return;
    try { setLead(await getLead(lead.id)); } catch {}
  };

  const generateAI = async () => {
    if (!lead.id) return;
    setAiLoading(true);
    try { const ai = await generateAISummary(lead.id); setLead(l => ({ ...l, ...ai })); onUpdate(); }
    catch (e: any) { alert(e.message); }
    finally { setAiLoading(false); }
  };

  const changeStatus = async (s: string) => {
    setStatus(s);
    if (lead.id) await updateLead(lead.id, { status: s as any });
    onUpdate();
  };

  const submitNote = async () => {
    if (!note.trim() || !lead.id) return;
    setAddingNote(true);
    try { await addLeadNote(lead.id, note); setNote(""); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setAddingNote(false); }
  };

  const score = lead.score || 0;
  const reasons: string[] = lead.score_reasons || [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-[500px] z-50 bg-[#12151e] border-l border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 p-5 border-b border-slate-700 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center text-white font-bold text-lg">
            {initials(lead.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white truncate">{lead.full_name || "Unknown"}</h2>
            <p className="text-sm text-slate-400 truncate">{[lead.city, lead.state].filter(Boolean).join(", ") || "—"}</p>
          </div>
          <div className={`px-3 py-1 rounded-full border text-xs font-bold ${scoreBg(score)}`}>
            <span className={scoreColor(score)}>{score}</span><span className="text-slate-500 ml-1">/100</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Contact */}
          <div className="p-5 border-b border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact</p>
            {lead.phone  && <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">📞</span><span className="text-slate-200">{lead.phone}</span></div>}
            {lead.email  && <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">✉️</span><span className="text-slate-200">{lead.email}</span></div>}
            {lead.address && <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">📍</span><span className="text-slate-400">{lead.address}</span></div>}
          </div>

          {/* Status */}
          <div className="p-5 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Status</p>
            <div className="flex flex-wrap gap-2">
              {(["new","contacted","qualified","converted","dead"] as const).map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-all ${
                    status === s ? statusColors[s] : "bg-transparent border-slate-700 text-slate-500 hover:border-slate-500"
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Wealth signals */}
          <div className="p-5 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Wealth Signals</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Home Value",        val: fmt(lead.estimated_home_value) },
                { label: "ZIP Median Income", val: fmt(lead.zip_median_income) },
                { label: "Homeowner",         val: lead.homeowner_status ? lead.homeowner_status.charAt(0).toUpperCase() + lead.homeowner_status.slice(1) : "—" },
                { label: "Business Owner",    val: lead.business_owner_flag ? "Yes" : "No" },
              ].map(({ label, val }) => (
                <div key={label} className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white">{val}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-400" : "bg-slate-600"}`}
                  style={{ width: `${score}%` }} />
              </div>
              <span className={`text-xs font-bold ${scoreColor(score)}`}>{score}/100</span>
            </div>
            {reasons.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-emerald-400 flex-shrink-0">✓</span>{r}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Summary */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Summary</p>
              <button onClick={generateAI} disabled={aiLoading}
                className="px-3 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 text-xs transition-colors disabled:opacity-50">
                {aiLoading ? "⟳ Analyzing…" : "✨ Generate"}
              </button>
            </div>
            {lead.ai_summary ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 leading-relaxed">{lead.ai_summary}</p>
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                  <div><span className="text-xs text-slate-500">Pitch: </span><span className="text-xs text-slate-200">{lead.ai_outreach_angle}</span></div>
                  <div><span className="text-xs text-slate-500">Confidence: </span>
                    <span className={`text-xs font-medium ${lead.ai_confidence === "high" ? "text-emerald-400" : lead.ai_confidence === "medium-high" ? "text-yellow-400" : "text-orange-400"}`}>
                      {lead.ai_confidence}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(lead.ai_insurance_types || []).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-xs text-indigo-300">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Click "Generate" for an AI prospect summary.</p>
            )}
          </div>

          {/* Outreach history */}
          {(lead.outreach_history || []).length > 0 && (
            <div className="p-5 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Outreach History</p>
              {lead.outreach_history!.map((e, i) => (
                <div key={i} className="flex items-start gap-3 text-xs mb-2">
                  <span className="text-slate-500 capitalize w-10 flex-shrink-0">{e.channel}</span>
                  <span className="text-slate-300 flex-1 line-clamp-2">{e.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notes</p>
            {(lead.notes_list || []).map((n, i) => (
              <div key={i} className="mb-2 text-xs text-slate-300 bg-slate-800/50 rounded-lg p-2.5">{n.note}</div>
            ))}
            <div className="flex gap-2 mt-2">
              <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && submitNote()}
                placeholder="Add a note…"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
              <button onClick={submitNote} disabled={addingNote || !note.trim()}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm disabled:opacity-40 transition-colors">+</button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 p-4 flex-shrink-0">
          <button onClick={() => setOutreachOpen(true)} disabled={!lead.phone && !lead.email}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
            📲 Reach Out
          </button>
        </div>
      </div>

      {outreachOpen && (
        <OutreachModal lead={lead} onClose={() => setOutreachOpen(false)} onLogged={() => { refresh(); onUpdate(); }} />
      )}
    </>
  );
}

// ─── LeadCard (inside chat results) ───────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: ProspectLead; onClick: () => void }) {
  const score = lead.score || 0;
  return (
    <div onClick={onClick}
      className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl p-3 cursor-pointer transition-all group">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
          {initials(lead.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{lead.full_name || "—"}</p>
          <p className="text-xs text-slate-400 truncate">{[lead.city, lead.state].filter(Boolean).join(", ") || "—"}</p>
        </div>
        <div className={`px-2 py-0.5 rounded-full border text-xs font-bold flex-shrink-0 ${scoreBg(score)}`}>
          <span className={scoreColor(score)}>{score}</span>
        </div>
      </div>
      {(lead.score_reasons || [])[0] && (
        <p className="text-xs text-slate-500 mt-2 pl-12 truncate">✓ {lead.score_reasons![0]}</p>
      )}
      <div className="flex gap-3 mt-2 pl-12 text-xs text-slate-500">
        {lead.phone && <span>📞 {lead.phone}</span>}
        {lead.email && <span className="truncate">✉️ {lead.email}</span>}
      </div>
    </div>
  );
}

// ─── Chat message renderer ────────────────────────────────────────────────────

function ChatMessage({ msg, onLeadClick }: { msg: ChatMsg; onLeadClick: (l: ProspectLead) => void }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.role === "thinking") {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (msg.role === "answer") {
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
        <div className="max-w-[80%] bg-slate-800/60 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.role === "results") {
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">AI</div>
        <div className="flex-1 min-w-0">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 mb-3">
            {msg.text}
            {msg.total > 0 && (
              <span className="ml-2 text-xs text-slate-400">({msg.total} found{msg.leads.length < msg.total ? `, showing ${msg.leads.length}` : ""})</span>
            )}
          </div>
          {msg.leads.length > 0 ? (
            <div className="space-y-2">
              {msg.leads.map(l => <LeadCard key={l.id} lead={l} onClick={() => onLeadClick(l)} />)}
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 text-sm text-slate-400">
              No leads matched those filters. Try importing leads first, or broaden your search.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Show me my top 10 highest scoring leads",
  "Find homeowners in Florida with high income",
  "Show me business owners with score above 70",
  "Find new leads I haven't contacted yet",
  "Show leads with home value over $500,000",
  "What does the wealth score mean?",
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsAgent() {
  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [selectedLead, setSelectedLead] = useState<ProspectLead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { getSavedSearches().then(setSavedSearches).catch(() => {}); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);
    setMessages(m => [...m, { role: "user", text: msg }, { role: "thinking" }]);

    try {
      const res = await leadsChat(msg);
      setMessages(m => {
        const withoutThinking = m.filter(x => x.role !== "thinking");
        if (res.action === "search") {
          return [...withoutThinking, { role: "results", text: res.reply, leads: res.leads, total: res.total, filters: res.filters }];
        }
        return [...withoutThinking, { role: "answer", text: res.reply }];
      });
    } catch (e: any) {
      setMessages(m => {
        const withoutThinking = m.filter(x => x.role !== "thinking");
        return [...withoutThinking, { role: "answer", text: `Error: ${e.message}` }];
      });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [sending]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0e1117] text-white overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-white">Leads Intelligence</h1>
          <p className="text-xs text-slate-500">AI-powered prospect scoring for sales &amp; broker teams</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-lg border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-xs font-medium transition-colors">
            📂 Import CSV
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">
            + Add Lead
          </button>
        </div>
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl">🎯</div>
            <div>
              <p className="text-white font-semibold text-lg mb-1">Leads Intelligence</p>
              <p className="text-sm text-slate-400 max-w-sm">Ask me anything about your leads. I'll search, filter, and score them for you.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-4 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl text-sm text-slate-300 hover:text-white transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} onLeadClick={setSelectedLead} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Saved searches bar */}
      {savedSearches.length > 0 && messages.length === 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {savedSearches.map(s => (
            <button key={s.id} onClick={() => send(s.name)}
              className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-full text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors">
              🔖 {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 hover:border-slate-500 focus-within:border-indigo-500 rounded-2xl px-4 py-3 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me to find leads… e.g. 'Show me homeowners in Texas with score above 60'"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            disabled={sending}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all flex-shrink-0">
            {sending ? <span className="animate-spin text-xs">⟳</span> : <span className="text-sm">↑</span>}
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">Powered by GPT-4o-mini / Claude — uses your imported leads database</p>
      </div>

      {/* Modals */}
      {selectedLead && (
        <LeadDetailDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={() => {}} />
      )}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onAdded={() => {}} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => {}} />
      )}
    </div>
  );
}
