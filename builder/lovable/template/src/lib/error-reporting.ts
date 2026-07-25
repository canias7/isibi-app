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

const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

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

/** The current route, hash history included — `#/book` is the part that identifies the page. */
const currentRoute = () =>
  typeof window === "undefined" ? "" : window.location.hash.slice(1) || window.location.pathname;

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
