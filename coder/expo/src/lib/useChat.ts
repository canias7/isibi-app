// ONE OPEN CHAT: loads it, follows it live while Coder works (a look every 1.5 s, as the web page's fallback),
// sends messages (they wait in line while Coder works), stops, answers cards, and changes the mode.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api, CoderEvent, Project } from './api';
import { mergeEvents } from './chat';

export const POLL_MS = 1500;

export function useChat(api: Api, id: string, pollMs = POLL_MS) {
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<CoderEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState<unknown[]>([]);
  const [sent, setSent] = useState<Record<string, string>>({});
  const next = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const fails = useRef(0);
  const runningRef = useRef(false);
  const ending = useRef(false);

  const stopPoll = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  const load = useCallback(async () => {
    stopPoll();
    const r = await api.open(id);
    if (!alive.current) return;
    if (r.status !== 200 || !r.data.project) { setError(r.data.error || 'The chat could not be opened.'); return; }
    setError('');
    setProject(r.data.project);
    setEvents(r.data.events || []);
    setQueue(r.data.queue || []);
    const run = r.data.project.status === 'running';
    setRunning(run); runningRef.current = run;
    next.current = 0; ending.current = false;
    if (run) schedule(300);
  }, [api, id]);

  function schedule(ms: number) { stopPoll(); timer.current = setTimeout(tick, ms); }

  async function tick() {
    timer.current = null;
    if (!alive.current || !runningRef.current) return;
    const r = await api.state(id, next.current, ending.current && project ? Number(project.turn) || 0 : undefined);
    if (!alive.current) return;
    if (r.status !== 200) {
      fails.current++;
      if (fails.current === 5) setEvents((e) => e.concat([{ type: 'error', text: "Coder's machine is not answering. Still trying…", at: Date.now() }]));
      schedule(Math.min(pollMs * Math.pow(2, fails.current), 30000));
      return;
    }
    fails.current = 0;
    const d = r.data;
    if (d.reload) { runningRef.current = false; setRunning(false); load(); return; }
    if (d.events && d.events.length) setEvents((cur) => mergeEvents(cur, d.events!));
    if (d.next) next.current = d.next;
    if (d.project) setProject(d.project);
    if (Array.isArray(d.queue)) setQueue(d.queue);
    const was = runningRef.current;
    runningRef.current = !!d.running;
    ending.current = !!d.running && (!!d.ending || ending.current);
    setRunning(!!d.running);
    if (d.running) schedule(pollMs);
    else if (was) load(); // the job ended: the saved chat, with the save's own lines
  }

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; stopPoll(); };
  }, [load]);

  const send = useCallback(async (text: string, pick: { model: string; effort: string }) => {
    text = text.trim();
    if (!text || !project || sending) return false;
    setSending(true); setError('');
    if (runningRef.current) {
      const q = await api.send(id, text, pick, true);
      setSending(false);
      if (q.status === 200 && q.data.queued) { setQueue(q.data.queue || []); return true; }
      if (q.status === 200 && q.data.reload) { load(); return true; }
      setError(q.data.error || 'The message was not sent.');
      return false;
    }
    setEvents((e) => e.concat([{ type: 'user', text, at: Date.now(), local: true }]));
    const r = await api.send(id, text, pick);
    setSending(false);
    if (r.status !== 200) {
      setEvents((e) => e.filter((x) => !(x.local && x.text === text)));
      setError(r.data.error || 'The message was not sent.');
      return false;
    }
    if (r.data.reload) { load(); return true; }
    if (r.data.project) setProject(r.data.project);
    runningRef.current = true; setRunning(true);
    next.current = 0; ending.current = false;
    schedule(300);
    return true;
  }, [api, id, project, sending, load]);

  const stop = useCallback(async () => {
    const r = await api.stop(id);
    if (r.status === 200 && r.data.reload) { runningRef.current = false; setRunning(false); load(); }
  }, [api, id, load]);

  const followTakenUp = (p?: Project) => {
    if (p && p.status === 'running' && !runningRef.current) { setProject(p); runningRef.current = true; setRunning(true); next.current = 0; schedule(300); }
  };

  const answer = useCallback(async (pid: string, choice: string, extra?: { answers?: unknown }) => {
    if (sent[pid]) return;
    setSent((x) => ({ ...x, [pid]: choice }));
    const r = await api.answer(id, { pid, choice, ...(extra && extra.answers ? { answers: extra.answers } : {}), ...(extra ? {} : { comment: '' }) });
    if (r.status !== 200) {
      setSent((x) => { const y = { ...x }; delete y[pid]; return y; });
      setError(r.data.error || 'Your answer could not be sent. Try again.');
      return;
    }
    followTakenUp(r.data.project);
  }, [api, id, sent]);

  const setMode = useCallback(async (mode: string) => {
    if (!project) return;
    const was = { mode: project.mode, modeAt: project.modeAt };
    setProject({ ...project, mode, modeAt: Date.now() });
    const r = await api.setMode(id, mode);
    if (r.status === 200 && r.data.project) setProject((p) => (p ? { ...p, mode: r.data.project.mode, modeAt: r.data.project.modeAt } : p));
    else { setProject((p) => (p ? { ...p, ...was } : p)); setError(r.data.error || 'The mode could not be changed.'); }
  }, [api, id, project]);

  return { project, events, running, error, sending, queue, sent, send, stop, answer, setMode, reload: load };
}
