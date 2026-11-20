// CODER'S API, the same calls the web page (coder/public/coder.js) makes to /api/coder/*.
import { API_BASE } from './config';
import type { Auth } from './auth';

export interface Model { id: string; name: string; efforts: string[]; effort?: string }
export interface Pick { model: string; effort: string; mode?: string }
export interface Settings { models: Model[]; pick: Pick; prefs: { autoOff?: boolean } }
export interface ProjectEntry { id: string; name: string; repo: string; title: string; status: string; at: number; waiting?: unknown }
export interface Project {
  id: string; repo: string; title?: string; status?: string; mode?: string; modeAt?: number; turn?: number;
  parked?: { pid?: string; kind?: string; call?: string } | null; [k: string]: unknown;
}
export interface CoderEvent { type: string; [k: string]: any }
export interface Repo { repo: string; branch?: string; private?: boolean }
export interface GitHub { connected: boolean; login?: string; install?: string }
export interface ChatState { project?: Project; events?: CoderEvent[]; next?: number; running?: boolean; ending?: boolean; reload?: boolean; queue?: unknown[] }
export interface Res<T> { status: number; data: T & { error?: string } }

type Fetch = typeof fetch;

export function createApi(auth: Auth, opts: { fetchFn?: Fetch; base?: string } = {}) {
  const base = (opts.base || API_BASE) + '/api/coder';
  const fetchFn: Fetch = opts.fetchFn || ((...a) => fetch(...a));

  async function call<T = any>(path: string, init?: { method?: string; body?: unknown }, again = false): Promise<Res<T>> {
    const token = await auth.accessToken();
    if (!token) return { status: 401, data: { error: 'sign in first' } as any };
    let r: Response;
    try {
      r = await fetchFn(base + path, {
        method: init?.method || 'GET',
        headers: { Authorization: 'Bearer ' + token, 'x-coder-proof': auth.proof(), ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch {
      return { status: 0, data: { error: 'Coder could not be reached. Check your connection.' } as any };
    }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && (data.signin === true || data.error === 'sign in first')) {
      if (data.signin !== true && !again) {
        const fresh = await auth.refresh(token);
        if (fresh && fresh.access_token !== token) return call(path, init, true);
        if (auth.current()) return { status: 0, data: { error: 'Sign-in could not be checked. Try again in a minute.' } as any };
      }
      await auth.end();
    }
    return { status: r.status, data };
  }

  const P = (id: string) => '/projects/' + encodeURIComponent(id);
  const newMid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  return {
    call,
    github: () => call<GitHub>('/github'),
    githubStart: () => call<{ url?: string }>('/github/start'),
    repos: () => call<{ repos: Repo[]; install?: string }>('/github/repos'),
    settings: () => call<Settings>('/settings'),
    savePick: (pick: Pick) => call('/settings', { method: 'POST', body: { ...pick, pickV: 2 } }),
    projects: () => call<{ projects: ProjectEntry[] }>('/projects'),
    newProject: async (repo: string) => {
      const r = await call<{ project: Project }>('/projects', { method: 'POST', body: { repo } });
      if (r.status === 200 && r.data.project) call(P(r.data.project.id) + '/warm', { method: 'POST' }).catch(() => {});
      return r;
    },
    deleteProject: (id: string) => call(P(id), { method: 'DELETE' }),
    open: (id: string) => call<{ project: Project; events: CoderEvent[]; queue?: unknown[] }>(P(id)),
    state: (id: string, since: number, turn?: number) => call<ChatState>(P(id) + '/state?since=' + since + (turn !== undefined ? '&turn=' + turn : '&early=1')),
    send: (id: string, text: string, pick: Pick, running = false) =>
      call<ChatState & { queued?: boolean }>(P(id) + '/message', { method: 'POST', body: running ? { text, mid: newMid() } : { mid: newMid(), text, comments: [], images: [], model: pick.model, effort: pick.effort } }),
    stop: (id: string) => call<{ reload?: boolean }>(P(id) + '/stop', { method: 'POST' }),
    setMode: (id: string, mode: string) => call<{ project: Project }>(P(id) + '/mode', { method: 'POST', body: { mode } }),
    answer: (id: string, body: { pid: string; choice: string; comment?: string; answers?: unknown }) => call<{ project?: Project }>(P(id) + '/answer', { method: 'POST', body }),
  };
}

export type Api = ReturnType<typeof createApi>;
