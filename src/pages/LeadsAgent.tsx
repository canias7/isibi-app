import { useState, useRef, useCallback } from "react";
import {
  ProspectLead, LeadFilters, SavedSearch,
  searchLeads, addLead, updateLead, getLead,
  addLeadNote, generateAISummary, generateLeadOutreach, logOutreachEvent,
  sendProspectSMS, callProspect, importLeadsCSV, getSavedSearches,
  saveSearch, deleteSavedSearch,
} from "../lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : s >= 40 ? "text-orange-400" : "text-slate-400";

const scoreBg = (s: number) =>
  s >= 80 ? "bg-emerald-500/20 border-emerald-500/40"
  : s >= 60 ? "bg-yellow-500/20 border-yellow-500/40"
  : s >= 40 ? "bg-orange-500/20 border-orange-500/40"
  : "bg-slate-700/40 border-slate-600/40";

const scoreLabel = (s: number) =>
  s >= 80 ? "High" : s >= 60 ? "Medium" : s >= 40 ? "Low-Med" : "Low";

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

// ─── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500"
              : score >= 40 ? "bg-orange-400" : "bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-7 text-right ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ─── OutreachModal ─────────────────────────────────────────────────────────────

function OutreachModal({ lead, onClose, onLogged }: {
  lead: ProspectLead; onClose: () => void; onLogged: () => void;
}) {
  const [tab, setTab]       = useState<"sms"|"email"|"call">("sms");
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
      await logOutreachEvent(lead.id!, {
        channel: tab,
        content: tab === "email" ? `${subject}\n\n${msg}` : msg,
      });
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
                : tab === "call" ? "📞 Start Call"
                : tab === "sms"  ? "📱 Send SMS" : "✉️ Send Email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AddLeadModal ─────────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState<Partial<ProspectLead>>({
    homeowner_status: "unknown", business_owner_flag: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ProspectLead, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name && !form.phone && !form.email) {
      alert("Add at least a name, phone, or email."); return;
    }
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
          <Field label="Full Name"  field="full_name"             placeholder="John Doe" />
          <Field label="Phone"      field="phone"                 placeholder="(305) 555-0100" />
          <Field label="Email"      field="email"                 placeholder="john@example.com" />
          <Field label="City"       field="city"                  placeholder="Miami" />
          <Field label="State"      field="state"                 placeholder="FL" />
          <Field label="ZIP Code"   field="zip_code"              placeholder="33101" />
          <Field label="Address"    field="address"               placeholder="123 Main St" span={2} />
          <Field label="Estimated Home Value ($)"  field="estimated_home_value"  type="number" placeholder="500000" />
          <Field label="ZIP Median Income ($)"     field="zip_median_income"     type="number" placeholder="85000" />
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
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
            {saving ? "Saving…" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LeadDetailDrawer ──────────────────────────────────────────────────────────

function LeadDetailDrawer({ lead: initial, onClose, onUpdate }: {
  lead: ProspectLead; onClose: () => void; onUpdate: () => void;
}) {
  const [lead, setLead]       = useState(initial);
  const [fetching, setFetching] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [note, setNote]         = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [status, setStatus]     = useState(lead.status || "new");

  const refresh = async () => {
    if (!lead.id) return;
    setFetching(true);
    try { setLead(await getLead(lead.id)); }
    catch {} finally { setFetching(false); }
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
      <div className="fixed top-0 right-0 h-full w-full max-w-[520px] z-50 bg-[#12151e] border-l border-slate-700 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-slate-700 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center text-white font-bold text-lg">
            {initials(lead.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white truncate">{lead.full_name || "Unknown"}</h2>
            <p className="text-sm text-slate-400 truncate">
              {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full border text-xs font-bold ${scoreBg(score)}`}>
              <span className={scoreColor(score)}>{score}</span>
              <span className="text-slate-500 ml-1">/100</span>
            </div>
            <button onClick={onClose}
              className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Contact info */}
          <div className="p-5 border-b border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact Info</p>
            {lead.phone  && <div className="flex items-center gap-2 text-sm"><span className="text-slate-500 w-5">📞</span><span className="text-slate-200">{lead.phone}</span></div>}
            {lead.email  && <div className="flex items-center gap-2 text-sm"><span className="text-slate-500 w-5">✉️</span><span className="text-slate-200">{lead.email}</span></div>}
            {lead.address && <div className="flex items-center gap-2 text-sm"><span className="text-slate-500 w-5">📍</span><span className="text-slate-400">{lead.address}</span></div>}
            {!lead.phone && !lead.email && !lead.address && <p className="text-sm text-slate-500">No contact info on file.</p>}
          </div>

          {/* Status */}
          <div className="p-5 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Status</p>
            <div className="flex flex-wrap gap-2">
              {(["new","contacted","qualified","converted","dead"] as const).map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-all ${
                    status === s ? statusColors[s] : "bg-transparent border-slate-700 text-slate-500 hover:border-slate-500"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Wealth signals */}
          <div className="p-5 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Wealth Probability Signals</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Home Value",          val: fmt(lead.estimated_home_value) },
                { label: "ZIP Median Income",   val: fmt(lead.zip_median_income) },
                { label: "Homeowner",           val: lead.homeowner_status ? lead.homeowner_status.charAt(0).toUpperCase() + lead.homeowner_status.slice(1) : "—" },
                { label: "Business Owner",      val: lead.business_owner_flag ? "Yes" : "No" },
              ].map(({ label, val }) => (
                <div key={label} className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white">{val}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 mb-2">Score Breakdown</p>
            <ScoreBar score={score} />
            {reasons.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>{r}
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
                {aiLoading ? "⟳ Analyzing…" : "✨ Generate AI"}
              </button>
            </div>
            {lead.ai_summary ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 leading-relaxed">{lead.ai_summary}</p>
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                  <div>
                    <span className="text-xs text-slate-500">Pitch angle: </span>
                    <span className="text-xs text-slate-200">{lead.ai_outreach_angle}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Confidence: </span>
                    <span className={`text-xs font-medium ${
                      lead.ai_confidence === "high" ? "text-emerald-400"
                      : lead.ai_confidence === "medium-high" ? "text-yellow-400"
                      : "text-orange-400"
                    }`}>{lead.ai_confidence}</span>
                  </div>
                  {(lead.ai_insurance_types || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lead.ai_insurance_types!.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-xs text-indigo-300">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Click "Generate AI" to get an intelligent prospect summary and pitch angle.</p>
            )}
          </div>

          {/* Outreach history */}
          {(lead.outreach_history || []).length > 0 && (
            <div className="p-5 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Outreach History</p>
              <div className="space-y-2">
                {lead.outreach_history!.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <span className="text-slate-500 capitalize w-10 flex-shrink-0">{e.channel}</span>
                    <span className="text-slate-300 flex-1 line-clamp-2">{e.content}</span>
                    <span className="text-slate-600 whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notes</p>
            {(lead.notes_list || []).map((n, i) => (
              <div key={i} className="mb-2 text-xs text-slate-300 bg-slate-800/50 rounded-lg p-2.5 leading-relaxed">{n.note}</div>
            ))}
            <div className="flex gap-2 mt-3">
              <input value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitNote()}
                placeholder="Add a note…"
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
              <button onClick={submitNote} disabled={addingNote || !note.trim()}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm disabled:opacity-40 transition-colors">
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4 flex gap-2 flex-shrink-0">
          <button onClick={() => setOutreachOpen(true)} disabled={!lead.phone && !lead.email}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
            📲 Reach Out
          </button>
        </div>
      </div>

      {outreachOpen && (
        <OutreachModal lead={lead} onClose={() => setOutreachOpen(false)}
          onLogged={() => { refresh(); onUpdate(); }} />
      )}
    </>
  );
}

// ─── LeadRow ───────────────────────────────────────────────────────────────────

function LeadRow({ lead, onClick, onStatusChange }: {
  lead: ProspectLead; onClick: () => void; onStatusChange: (s: string) => void;
}) {
  const score = lead.score || 0;
  return (
    <tr onClick={onClick}
      className="border-b border-slate-800/60 hover:bg-slate-800/30 cursor-pointer transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
            {initials(lead.full_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{lead.full_name || "—"}</p>
            <p className="text-xs text-slate-500 truncate">{lead.lead_source || "manual"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {lead.phone || lead.email || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="w-28">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${
                score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500"
                : score >= 40 ? "bg-orange-400" : "bg-slate-600"
              }`} style={{ width: `${score}%` }} />
            </div>
            <span className={`text-xs font-bold ${scoreColor(score)}`}>{score}</span>
          </div>
          <p className={`text-xs mt-0.5 ${scoreColor(score)}`}>{scoreLabel(score)}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px]">
        <span className="line-clamp-2">{(lead.score_reasons || [])[0] || "—"}</span>
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <select value={lead.status || "new"} onChange={e => onStatusChange(e.target.value)}
          className={`text-xs rounded-full px-2 py-1 border cursor-pointer focus:outline-none bg-transparent ${statusColors[lead.status || "new"]}`}>
          {["new","contacted","qualified","converted","dead"].map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>
      </td>
    </tr>
  );
}

// ─── ImportPage ────────────────────────────────────────────────────────────────

function ImportPage({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult]   = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => { setFile(f); setResult(null); };

  const doImport = async () => {
    if (!file) return;
    setImporting(true); setResult(null);
    try {
      const r = await importLeadsCSV(file);
      setResult(r);
      if (r.imported > 0) onImported();
    } catch (e: any) { alert(e.message); }
    finally { setImporting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Import Leads from CSV</h2>
        <p className="text-sm text-slate-400">Upload a CSV file — every lead gets auto-scored on wealth probability signals instantly.</p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragging ? "border-indigo-500 bg-indigo-500/10" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/20"
        }`}>
        <p className="text-4xl mb-3">📂</p>
        <p className="text-white font-medium">{file ? file.name : "Drop CSV here or click to browse"}</p>
        <p className="text-xs text-slate-500 mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : ".csv files only"}</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      </div>

      {/* Column reference */}
      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Supported CSV Columns</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {[
            ["full_name / name",          "Full name"],
            ["first_name / last_name",    "Split name"],
            ["phone",                     "Phone number"],
            ["email",                     "Email address"],
            ["city / state",              "Location"],
            ["zip_code / zip",            "ZIP code"],
            ["address",                   "Street address"],
            ["estimated_home_value",      "Home value ($)"],
            ["zip_median_income",         "Area median income ($)"],
            ["homeowner_status",          "owner / renter / unknown"],
            ["business_owner_flag",       "yes / no"],
            ["lead_source",               "Where lead came from"],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-2">
              <code className="text-indigo-400 flex-shrink-0">{col}</code>
              <span className="text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {file && (
        <button onClick={doImport} disabled={importing}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors">
          {importing ? "⟳ Importing…" : `Import "${file.name}"`}
        </button>
      )}

      {result && (
        <div className={`rounded-xl p-4 border ${
          result.imported > 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800 border-slate-700"
        }`}>
          <p className="font-semibold text-white mb-1">
            {result.imported > 0 ? `✓ ${result.imported} leads imported and scored` : "Import complete"}
            {result.skipped > 0 && <span className="text-slate-400 text-sm ml-2">({result.skipped} skipped)</span>}
          </p>
          {result.errors.map((e, i) => <p key={i} className="text-xs text-red-400 mt-1">{e}</p>)}
        </div>
      )}
    </div>
  );
}

// ─── FiltersPanel ──────────────────────────────────────────────────────────────

function FiltersPanel({ filters, onChange, onSearch, onSave, savedSearches, onLoadSearch, onDeleteSearch, total }: {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  onSearch: () => void;
  onSave: () => void;
  savedSearches: SavedSearch[];
  onLoadSearch: (s: SavedSearch) => void;
  onDeleteSearch: (id: number) => void;
  total: number;
}) {
  const set = (k: keyof LeadFilters, v: any) => onChange({ ...filters, [k]: v });

  return (
    <div className="w-64 flex-shrink-0 bg-slate-900/40 border-r border-slate-800 flex flex-col overflow-y-auto">
      <div className="p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Filter Leads</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Name / Phone / Email</label>
            <input value={filters.q || ""} onChange={e => set("q", e.target.value)}
              placeholder="Search…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">State</label>
            <input value={filters.state || ""} maxLength={2}
              onChange={e => set("state", e.target.value.toUpperCase())} placeholder="FL"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">City</label>
            <input value={filters.city || ""} onChange={e => set("city", e.target.value)} placeholder="Miami"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">ZIP Code</label>
            <input value={filters.zip_code || ""} onChange={e => set("zip_code", e.target.value)} placeholder="33101"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-500">Min Score</label>
              <span className="text-xs text-slate-300">{filters.min_score ?? 0}</span>
            </div>
            <input type="range" min={0} max={100} value={filters.min_score ?? 0}
              onChange={e => set("min_score", Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Homeowner</label>
            <select value={filters.homeowner || "any"} onChange={e => set("homeowner", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
              <option value="any">Any</option>
              <option value="owner">Owner</option>
              <option value="renter">Renter</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Business Owner</label>
            <select value={filters.business_owner || "any"}
              onChange={e => set("business_owner", e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Min Home Value ($)</label>
            <input type="number" value={filters.min_home_value || ""}
              onChange={e => set("min_home_value", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 300000"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Status</label>
            <select value={filters.status || "all"}
              onChange={e => set("status", e.target.value === "all" ? "" : e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
              <option value="all">All Statuses</option>
              {["new","contacted","qualified","converted","dead"].map(s =>
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              )}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onSearch}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
            Find Leads
          </button>
          <button onClick={onSave} title="Save this search"
            className="w-10 flex items-center justify-center rounded-lg border border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white transition-colors">
            🔖
          </button>
        </div>

        {total > 0 && (
          <p className="text-xs text-slate-500 text-center mt-2">{total.toLocaleString()} lead{total !== 1 ? "s" : ""} found</p>
        )}
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Saved Searches</p>
          <div className="space-y-1">
            {savedSearches.map(s => (
              <div key={s.id} className="flex items-center gap-1 group">
                <button onClick={() => onLoadSearch(s)}
                  className="flex-1 text-left text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-slate-800 transition-colors truncate">
                  {s.name}
                </button>
                <button onClick={() => onDeleteSearch(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs px-1 transition-all">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsAgent() {
  const [tab, setTab]           = useState<"search"|"import">("search");
  const [leads, setLeads]       = useState<ProspectLead[]>([]);
  const [total, setTotal]       = useState(0);
  const [filters, setFilters]   = useState<LeadFilters>({ min_score: 0 });
  const [loading, setLoading]   = useState(false);
  const [selectedLead, setSelectedLead] = useState<ProspectLead | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [searched, setSearched] = useState(false);

  const fetchSaved = useCallback(async () => {
    try { setSavedSearches(await getSavedSearches()); } catch {}
  }, []);

  // Load saved searches on mount (run once)
  useState(() => { fetchSaved(); });

  const doSearch = useCallback(async (f: LeadFilters = filters) => {
    setLoading(true); setSearched(true);
    try { const res = await searchLeads(f); setLeads(res.leads); setTotal(res.total); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  const handleStatusChange = async (lead: ProspectLead, status: string) => {
    if (!lead.id) return;
    await updateLead(lead.id, { status: status as any });
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: status as any } : l));
  };

  const handleSaveSearch = async () => {
    if (!saveNameInput.trim()) return;
    await saveSearch(saveNameInput.trim(), filters, total);
    setSaveNameInput(""); setShowSaveInput(false);
    fetchSaved();
  };

  return (
    <div className="h-screen flex flex-col bg-[#0e1117] text-white overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Leads Intelligence</h1>
          <p className="text-xs text-slate-500">Wealth-signal scoring for sales &amp; broker teams</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-800/60 rounded-lg p-1">
            {(["search","import"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}>
                {t === "search" ? "🔍 Search" : "📂 Import CSV"}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
            + Add Lead
          </button>
        </div>
      </div>

      {tab === "import" ? (
        <div className="flex-1 overflow-y-auto">
          <ImportPage onImported={() => doSearch(filters)} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <FiltersPanel
            filters={filters}
            onChange={setFilters}
            onSearch={() => doSearch(filters)}
            onSave={() => setShowSaveInput(s => !s)}
            savedSearches={savedSearches}
            onLoadSearch={s => { setFilters(s.filters); doSearch(s.filters); }}
            onDeleteSearch={async id => { await deleteSavedSearch(id); fetchSaved(); }}
            total={total}
          />

          {/* Results area */}
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* Save search bar */}
            {showSaveInput && (
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex-shrink-0">
                <input value={saveNameInput} onChange={e => setSaveNameInput(e.target.value)}
                  placeholder="Name this search…" autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleSaveSearch(); if (e.key === "Escape") setShowSaveInput(false); }}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
                <button onClick={handleSaveSearch}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm transition-colors">
                  Save
                </button>
                <button onClick={() => setShowSaveInput(false)} className="text-slate-400 hover:text-white px-2 text-sm">✕</button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Searching leads…</p>
              </div>

            ) : !searched ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-8">
                <div className="text-5xl">🎯</div>
                <div>
                  <p className="text-white font-semibold mb-1">Find High-Probability Prospects</p>
                  <p className="text-sm text-slate-400 max-w-sm">
                    Use the filters on the left to search by location, score, homeowner status, and more.
                    Or import a CSV to get started.
                  </p>
                </div>
                <button onClick={() => doSearch({})}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-medium transition-colors">
                  Show All Leads
                </button>
              </div>

            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
                <div className="text-5xl">📭</div>
                <p className="text-white font-semibold">No leads found</p>
                <p className="text-sm text-slate-400">Try adjusting your filters, or import leads via the CSV tab.</p>
              </div>

            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60 sticky top-0">
                    {["Name / Source","Location","Contact","Score","Top Reason","Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <LeadRow key={l.id} lead={l}
                      onClick={() => setSelectedLead(l)}
                      onStatusChange={s => handleStatusChange(l, s)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Lead detail drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => doSearch(filters)}
        />
      )}

      {/* Add lead modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => doSearch(filters)}
        />
      )}
    </div>
  );
}
