// Runtime error reporting. Adapted from Lovable's error-capture.ts / lovable-error-reporting.ts
// pair, minus the half of theirs that only exists because they render on a server: their
// error-capture.ts wraps console.error to recover a stack that h3 has already flattened into a
// generic 500. We are a client-rendered SPA — there is no h3 and no server request to salvage — so
// what carries over is the client half: expand the cause chain, catch what escapes React, and
// forward it somewhere a human will see it.
//
// The finding this exists for is one they document and one the build-time smoke check ran into
// independently: **React does not rethrow a boundary-caught error to window.onerror.** So an app
// that white-screens in production emits nothing to a plain `onerror` hook. The error component has
// to report the error itself, which is why reportAppError is called from there rather than relied on
// being picked up globally.

import { siteSlug } from "./rows";

const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;
/**
 * At most this many reports leave one page load. A render loop throws the same
 * error hundreds of times a second; the first few say everything the owner can
 * act on, and the rest are a flood aimed at our own endpoint. The server rate
 * limit exists too — this is the polite half.
 */
const MAX_REPORTS_PER_LOAD = 5;
let sentReports = 0;

declare global {
  interface Window {
    /** Injected by the isibi preview shell. Absent on a published site, which is intentional. */
    __isibiReportRuntimeError?: (payload: ErrorReport) => void;
  }
}

export interface ErrorReport {
  message: string;
  stack?: string;
  route: string;
  source: "error_boundary" | "onerror" | "unhandledrejection";
}

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * A readable description of an error INCLUDING its cause chain. `String(err)` stops at the outermost
 * message, which is routinely the least informative one — "Failed to load resource" wrapping the
 * request that actually failed.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

/**
 * A one-line message. A loader or a fetch wrapper commonly throws a raw Response, whose String() is
 * the useless "[object Response]" — pull the status and URL out instead.
 */
function messageFor(error: unknown): string {
  if (error instanceof Response)
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * WHICH PAGE BROKE — the path, and only then the fragment.
 *
 * This preferred `location.hash` and its comment said "`#/book` is the part that
 * identifies the page". True under `createHashHistory()`; the router moved to
 * browser history on 2026-08-09 and the hash stopped being a route. It is an
 * ordinary in-page anchor now — PAGE_RULES blesses `#prices`, the lint exempts
 * it, and the reference page puts three of them in the SITE HEADER, so they are
 * on every page of a reference-shaped site.
 *
 * Harmless while this value only reached the console. Round 7 made it the ONE
 * field telling the owner where their site broke, and persists it — so a
 * visitor who had clicked "Prices" and then hit a throw was reported as
 * `route: "prices"`, a section anchor that is not a page, looking plausible
 * enough that nobody could tell it was wrong.
 *
 * The mount prefix is stripped, or the same fault reads `/book` on the
 * customer's domain and `/s/<slug>/book` in the workspace. The fragment is kept
 * as a SUFFIX: which section they were on is real information, it just is not
 * the page.
 */
const currentRoute = () => {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname.replace(/^\/s\/[a-z0-9][a-z0-9-]*/i, "") || "/";
  return path + (window.location.hash || "");
};

export function reportAppError(error: unknown, source: ErrorReport["source"] = "error_boundary") {
  if (typeof window === "undefined") return;
  const report: ErrorReport = {
    message: messageFor(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: currentRoute(),
    source,
  };
  // The console first, always: it is the one destination that works on a published site with no
  // preview shell attached, and it is what the build-time smoke check reads.
  console.error(`[${source}] ${report.route}: ${describeError(error)}`);
  try {
    window.__isibiReportRuntimeError?.(report);
  } catch {
    /* reporting must never throw */
  }
  // The preview runs the app in an iframe, so the editor cannot read its console. postMessage is
  // the only channel across that boundary.
  try {
    window.parent?.postMessage({ type: "isibi:runtime-error", report }, "*");
  } catch {
    /* cross-origin */
  }
  // AND THE PLATFORM, which is the half that was missing (2026-08-14 audit): on a
  // published site the report used to go to the visitor's console and die, so the
  // owner learned their booking form was broken only when customers stopped
  // coming. Same-origin POST — the slug comes from where the page is served, the
  // way every data call already finds its API — fire-and-forget with `keepalive`
  // so a report survives the navigation the error often causes. Clipped here as
  // well as server-side, because an 8KB stack is the payload and not the point.
  try {
    const slug = siteSlug();
    if (slug && slug !== "preview" && sentReports < MAX_REPORTS_PER_LOAD) {
      sentReports++;
      void fetch(`/api/db/${slug}/error`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          message: report.message.slice(0, 300),
          stack: report.stack?.slice(0, 2000),
          route: report.route.slice(0, 200),
          source: report.source,
        }),
      }).catch(() => {});
    }
  } catch {
    /* reporting must never throw */
  }
}

let installed = false;

/** Catch what never reaches a React boundary: event handlers, timers, rejected promises. */
export function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) =>
    reportAppError(event.error ?? event.message, "onerror"),
  );
  window.addEventListener("unhandledrejection", (event) =>
    reportAppError(event.reason, "unhandledrejection"),
  );
}
