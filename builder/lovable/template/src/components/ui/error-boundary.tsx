import * as React from "react";
import { Button } from "@/components/ui/button";
/**
 * Catches a crash in the tree below it and shows something instead of a
 * blank page.
 *
 * A class component, because there is still no hook for this — `componentDidCatch`
 * and `getDerivedStateFromError` have no function equivalent.
 *
 * It does NOT show the error text. A stack trace on a customer's screen is
 * noise to them and detail about our internals to anybody else; `onError`
 * hands it to the caller to log.
 *
 * `resetKey` clears the error when it changes — pass the route path, so
 * navigating away from a broken page actually escapes it. Without that, one
 * crash freezes every page underneath this boundary until a full reload.
 */
export class ErrorBoundary extends React.Component<
  { children?: React.ReactNode; fallback?: React.ReactNode; onError?: (e: unknown) => void; resetKey?: unknown },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onError?.(error); }
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border px-6 py-12 text-center">
        <p className="text-sm font-medium">Something went wrong on this page.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Reloading usually fixes it. If it keeps happening, let us know what you were doing.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
    );
  }
}
