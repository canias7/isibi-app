// Data access for a generated site.
//
// The generator should never write fetch code — it calls these hooks and names
// a table. Everything else (where the site lives, how rows are shaped, how the
// cache is invalidated after a write) is handled here once.
//
// The API is the platform's: /api/db/<slug>/rows/<table>. Only tables declared
// `access: "public"` in isibi.schema.json are reachable; an owner-scoped table
// returns 403 until visitor accounts exist.
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

export type Row = Record<string, unknown> & { id: number };

/** Query parameters a list read accepts. Anything else is ignored by the API. */
export type RowQuery = {
  limit?: number;
  offset?: number;
  /** Column to sort by. Falls back to id if the table did not declare it. */
  order?: string;
  dir?: "asc" | "desc";
  /** Full-text search — only does anything if the table declared `fts`. */
  q?: string;
  /** Any declared column, as an equality filter. */
  [column: string]: string | number | undefined;
};

/**
 * A published site is served from /s/<slug>/, so it can read its own slug off
 * the path rather than having the generator bake it in. Falls back to a build
 * -time value for local dev, where the site is served from /.
 */
export function siteSlug(): string {
  const fromPath = window.location.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]*)/i);
  if (fromPath) return fromPath[1].toLowerCase();
  return (import.meta as { env?: Record<string, string> }).env?.VITE_SITE_SLUG ?? "preview";
}

const base = (table: string) => `/api/db/${siteSlug()}/rows/${table}`;

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  // The member's session, when there is one. Sent on every call: a `user` table
  // answers 401 without it and that member's own rows with it.
  const token = (() => { try { return localStorage.getItem(`site_session_${siteSlug()}`); } catch { return null; } })();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The API distinguishes the caller's fault from a server fault, so surface
    // its message and code rather than a generic failure.
    const err = new Error((body as { error?: string }).error || `request failed (${res.status})`);
    (err as Error & { code?: string; status: number }).code = (body as { code?: string }).code;
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return body as T;
}

function qs(params?: RowQuery): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Rows from one table. Re-runs whenever `params` changes. */
export function useRows<T extends Row = Row>(
  table: string,
  params?: RowQuery,
  options?: Omit<UseQueryOptions<{ rows: T[] }, Error, T[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["rows", table, params ?? {}],
    queryFn: () => send<{ rows: T[] }>(base(table) + qs(params)),
    select: (d) => d.rows,
    ...options,
  });
}

/** One row by id, read from the list endpoint so it obeys the same rules. */
export function useRow<T extends Row = Row>(table: string, id: number | undefined) {
  return useQuery({
    queryKey: ["row", table, id],
    enabled: id !== undefined,
    queryFn: () => send<{ rows: T[] }>(base(table) + qs({ id })),
    select: (d) => d.rows[0],
  });
}

/** Invalidate every cached read of a table after it changes. */
function useInvalidate(table: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["rows", table] });
    qc.invalidateQueries({ queryKey: ["row", table] });
  };
}

export function useCreateRow<T extends Row = Row>(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: (values: Partial<T>) =>
      // `claim` comes back only for a `collect` table: a signed token for THIS
      // row, and the only time it is ever issued. Keep it (a link, an email, the
      // thank-you page) and the person who submitted can come back to their own
      // submission — see useClaimedRow. Optional because no other access level
      // mints one.
      send<{ row: T; claim?: string }>(base(table), { method: "POST", body: JSON.stringify(values) }),
    onSuccess: invalidate,
  });
}

export function useUpdateRow<T extends Row = Row>(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: ({ id, ...values }: Partial<T> & { id: number }) =>
      send<{ row: T }>(`${base(table)}/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: invalidate,
  });
}

export function useDeleteRow(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: (id: number) => send<{ ok: true }>(`${base(table)}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ── Visitor accounts ────────────────────────────────────────────────────────
//
// The site's own members — a barber shop's customers — not isibi accounts. A
// session is a signed token from /api/db/<slug>/auth/*, kept in localStorage and
// sent as a Bearer header on every call. Tables at access `user` are private per
// member; `feed` and `admin` are readable to anyone signed in.

const TOKEN_KEY = () => `site_session_${siteSlug()}`;

export function getSessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY()); } catch { return null; }
}
function setSessionToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY(), token) : localStorage.removeItem(TOKEN_KEY()); } catch { /* private mode */ }
}

export type Member = { id: number; email: string };

const authUrl = (action: string) => `/api/db/${siteSlug()}/auth/${action}`;

/**
 * The signed-in member, or null. `isPending` while it is being checked — render
 * neither the signed-in nor the signed-out view until it settles, or the page
 * flashes a login form at somebody who is already logged in.
 */
export function useMember() {
  const token = getSessionToken();
  return useQuery({
    queryKey: ["member", token],
    // Nothing to ask about when there is no token; resolve to null immediately.
    queryFn: async (): Promise<Member | null> => {
      if (!token) return null;
      try {
        const r = await send<{ user: Member }>(authUrl("me"), { headers: { Authorization: `Bearer ${token}` } });
        return r.user;
      } catch {
        // A rejected token is spent — a month-old session, or an account since
        // removed. Clear it so the page offers a fresh login instead of looping.
        setSessionToken(null);
        return null;
      }
    },
    staleTime: 60_000,
  });
}

function useAuthAction(action: "signup" | "login") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { email: string; password: string }) =>
      send<{ token: string; user: Member }>(authUrl(action), { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (d) => {
      setSessionToken(d.token);
      // Every read changes meaning once there is a session — a `user` table goes
      // from 401 to that member's own rows.
      qc.invalidateQueries();
    },
  });
}

export const useSignup = () => useAuthAction("signup");
export const useLogin = () => useAuthAction("login");

export function useLogout() {
  const qc = useQueryClient();
  return () => { setSessionToken(null); qc.invalidateQueries(); };
}

/** Ask for a reset link. Always succeeds, whether or not the address has an account. */
/**
 * Change the password while signed in.
 *
 * The current one is required even though there is already a session: without
 * it, a stolen token is a permanent takeover. Succeeding signs out every OTHER
 * session and hands back a fresh token for this one, which is stored here so the
 * member stays logged in through their own change.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (vars: { current: string; next: string }) => {
      const r = await send<{ ok: true; token: string }>(`/api/db/${siteSlug()}/auth/password`, {
        method: "POST",
        body: JSON.stringify(vars),
      });
      try { localStorage.setItem(`site_session_${siteSlug()}`, r.token); } catch { /* private mode */ }
      return r;
    },
  });
}

// ---------------------------------------------------------------- sign-in methods

function keepSession(token: string) {
  try { localStorage.setItem(`site_session_${siteSlug()}`, token); } catch { /* private mode */ }
}

export type SignInMethod = { name: string; label: string; oauth: boolean };

/**
 * What this site actually offers. Render the sign-in page from this rather than
 * hard-coding buttons — a provider the owner has not set up is not a button that
 * fails, it simply is not there.
 */
export function useSignInMethods() {
  return useQuery({
    queryKey: ["auth-methods", siteSlug()],
    queryFn: () => send<{ methods: SignInMethod[] }>(authUrl("methods")).then((r) => r.methods),
  });
}

/** Send them to a provider. A full navigation, because the provider redirects back. */
export function startOAuthSignIn(provider: string, next?: string) {
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  location.href = authUrl(`oauth/${provider}/start`) + q;
}

/** A response that may not be a session yet: a second factor can be pending. */
export type SignInResult = { token?: string; pending?: string; need?: string; user?: Member };

function settle(r: SignInResult) {
  if (r.token) keepSession(r.token);
  return r;
}

/** Sign in with a passkey. No password, nothing typed, phishing-proof. */
export function usePasskeySignIn() {
  return useMutation({
    mutationFn: async (): Promise<SignInResult> => {
      const start = await send<{ challenge: string; rpId: string }>(authUrl("passkey/login/start"), { method: "POST" });
      const cred = (await navigator.credentials.get({
        publicKey: { challenge: fromB64u(start.challenge), rpId: start.rpId, userVerification: "preferred" },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("No passkey was chosen.");
      const res = cred.response as AuthenticatorAssertionResponse;
      return settle(await send<SignInResult>(authUrl("passkey/login/finish"), {
        method: "POST",
        body: JSON.stringify({
          challenge: start.challenge,
          credentialId: toB64u(cred.rawId),
          response: {
            clientDataJSON: toB64u(res.clientDataJSON),
            authenticatorData: toB64u(res.authenticatorData),
            signature: toB64u(res.signature),
          },
        }),
      }));
    },
  });
}

/** Add a passkey to the account they are already signed into. */
export function useAddPasskey() {
  return useMutation({
    mutationFn: async (vars?: { label?: string }) => {
      const start = await send<{
        challenge: string; rp: { id: string; name: string };
        user: { id: string; name: string; displayName: string };
        excludeCredentials: { id: string; type: string }[];
        pubKeyCredParams: { type: string; alg: number }[];
      }>(authUrl("passkey/register/start"), { method: "POST" });
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: fromB64u(start.challenge),
          rp: start.rp,
          user: { id: fromB64u(start.user.id), name: start.user.name, displayName: start.user.displayName },
          pubKeyCredParams: start.pubKeyCredParams as PublicKeyCredentialParameters[],
          excludeCredentials: start.excludeCredentials.map((c) => ({ id: fromB64u(c.id), type: "public-key" as const })),
          authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("No passkey was created.");
      const res = cred.response as AuthenticatorAttestationResponse;
      return send<{ ok: true }>(authUrl("passkey/register/finish"), {
        method: "POST",
        body: JSON.stringify({
          label: vars?.label,
          response: { clientDataJSON: toB64u(res.clientDataJSON), attestationObject: toB64u(res.attestationObject) },
        }),
      });
    },
  });
}

/** Ask for a sign-in code by email. Always succeeds, account or not. */
export function useRequestSignInCode() {
  return useMutation({
    mutationFn: (vars: { email: string }) =>
      send<{ ok: true }>(authUrl("code/request"), { method: "POST", body: JSON.stringify(vars) }),
  });
}

export function useVerifySignInCode() {
  return useMutation({
    mutationFn: (vars: { email: string; code: string }) =>
      send<SignInResult>(authUrl("code/verify"), { method: "POST", body: JSON.stringify(vars) }).then(settle),
  });
}

/**
 * Present the second factor.
 *
 * `pending` comes from whichever primary method returned it — a session is not
 * issued until this succeeds. A recovery code works here too.
 */
export function useVerifySecondFactor() {
  return useMutation({
    mutationFn: async (vars: { pending: string; code: string }) => {
      const r = await send<SignInResult>(authUrl("totp/verify"), {
        method: "POST",
        body: JSON.stringify({ code: vars.code }),
        headers: { Authorization: `Bearer ${vars.pending}` },
      });
      return settle(r);
    },
  });
}

/** Turn on an authenticator app: scan, then confirm with a code. */
export function useStartTotp() {
  return useMutation({ mutationFn: () => send<{ secret: string; uri: string }>(authUrl("totp/start"), { method: "POST" }) });
}
export function useEnableTotp() {
  return useMutation({
    mutationFn: (vars: { code: string }) =>
      send<{ ok: true; recovery: string[] }>(authUrl("totp/enable"), { method: "POST", body: JSON.stringify(vars) }),
  });
}
export function useDisableTotp() {
  return useMutation({
    mutationFn: (vars: { current: string }) =>
      send<{ ok: true }>(authUrl("totp/disable"), { method: "POST", body: JSON.stringify(vars) }),
  });
}

/** What this member has connected — providers, passkeys, whether 2FA is on. */
export function useConnectedAccounts() {
  return useQuery({
    queryKey: ["identities", siteSlug()],
    queryFn: () => send<{
      identities: { id: number; provider: string; email: string | null; created_at: string }[];
      passkeys: { id: number; label: string | null; created_at: string; last_used_at: string | null }[];
      hasPassword: boolean; totp: boolean;
    }>(authUrl("identities")),
  });
}

// WebAuthn speaks ArrayBuffers; the API speaks base64url.
function toB64u(buf: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(v: string) {
  const p = v.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Sign out every OTHER device, keeping this one. */
export function useLogoutOthers() {
  return useMutation({
    mutationFn: async () => {
      const r = await send<{ ok: true; token: string }>(`/api/db/${siteSlug()}/auth/logout-all`, { method: "POST" });
      try { localStorage.setItem(`site_session_${siteSlug()}`, r.token); } catch { /* private mode */ }
      return r;
    },
  });
}

/** Change the account's email. Needs the password, because the address IS the account. */
export function useChangeEmail() {
  return useMutation({
    mutationFn: async (vars: { current: string; next: string }) => {
      const r = await send<{ ok: true; token: string; user: Member }>(`/api/db/${siteSlug()}/auth/email`, {
        method: "POST",
        body: JSON.stringify(vars),
      });
      try { localStorage.setItem(`site_session_${siteSlug()}`, r.token); } catch { /* private mode */ }
      return r;
    },
  });
}

/** Close the account for good. Their existing rows stay with the site owner. */
export function useCloseAccount() {
  return useMutation({
    mutationFn: async (vars: { current: string }) => {
      const r = await send<{ ok: true }>(`/api/db/${siteSlug()}/auth/close`, {
        method: "POST",
        body: JSON.stringify(vars),
      });
      try { localStorage.removeItem(`site_session_${siteSlug()}`); } catch { /* private mode */ }
      return r;
    },
  });
}

export function useRequestReset() {
  return useMutation({
    mutationFn: (values: { email: string }) =>
      send<{ ok: true }>(authUrl("reset"), { method: "POST", body: JSON.stringify(values) }),
  });
}

// ── Attaching a picture ──────────────────────────────────────────────────────
//
// A file column is an ordinary TEXT column holding a URL. The flow is: upload
// the file, get a URL back, put that URL in the form value, submit the row as
// normal. There is no multipart row write and there is no "file field" — the
// row is still plain JSON.
//
// The endpoint only accepts a file for a table a visitor can write to that also
// declares somewhere to put it, so a form of six text fields cannot upload at
// all. Getting a 403 here means the schema has no image column, not that the
// visitor did something wrong.

export type UploadResult = { url: string; name: string; size: number; mime: string };

/**
 * Upload one picture for `table` and resolve to its URL.
 *
 * Raw bytes, not multipart or base64: the server decides the type from the
 * leading bytes regardless of what is declared, and base64 would inflate a
 * phone photo by a third for nothing.
 */
export async function uploadFile(table: string, file: File): Promise<UploadResult> {
  const res = await fetch(`/api/db/${siteSlug()}/uploads?table=${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; url?: string } & UploadResult;
  if (!res.ok || !body.url) {
    const err = new Error(body.error || `upload failed (${res.status})`);
    (err as Error & { code?: string; status: number }).code = body.code;
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return body;
}

/**
 * The same, as a mutation, so a form can show progress and an error the way it
 * does for every other write.
 */
export function useUploadFile(table: string) {
  return useMutation({
    mutationFn: (file: File) => uploadFile(table, file),
  });
}

// ── The public view ─────────────────────────────────────────────────────────
//
// Some tables publish a named, PII-filtered projection that anyone may read,
// even though the table itself is not readable. The case it exists for is a
// booking page: it needs to know WHICH SLOTS ARE TAKEN without learning
// anything about who took them.
//
// Only tables whose schema declares `publicView` have one — asking for it on a
// table that does not is a 404, not an error worth surfacing.

/**
 * Read a table's declared public projection.
 *
 * `params` may filter, but only on the columns the projection itself publishes;
 * anything else is ignored by the API rather than honoured, so this cannot be
 * used to ask about a column the site chose not to publish.
 */
export function usePublicRows<T extends Row = Row>(table: string, params?: RowQuery) {
  return useQuery({
    queryKey: ["public", siteSlug(), table, params],
    queryFn: () => send<{ rows: T[] }>(`${base(table)}/public${qs(params)}`).then((r) => r.rows),
  });
}

/**
 * One submission, read back by the person who made it.
 *
 * A `collect` table is write-only — nobody can list it — so this is the single
 * exception, and it opens exactly one row: the `claim` handed back by
 * `useCreateRow` when that row was created. Put the token in the link you send
 * ("manage your booking") and read it off the URL here. A missing, wrong, or
 * expired token is a plain 404, the same as a row that isn't there.
 */
export function useClaimedRow<T extends Row = Row>(table: string, id: number | undefined, claim: string | undefined) {
  return useQuery({
    enabled: id !== undefined && !!claim,
    queryKey: ["claim", siteSlug(), table, id],
    queryFn: () =>
      send<{ row: T }>(`${base(table)}/${id}?claim=${encodeURIComponent(claim as string)}`).then((r) => r.row),
  });
}

/** Cancel that same submission. Safe to call twice — the second answers ok too. */
export function useCancelClaim(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: ({ id, claim }: { id: number; claim: string }) =>
      send<{ ok: true; cancelled: true }>(`${base(table)}/${id}?claim=${encodeURIComponent(claim)}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
