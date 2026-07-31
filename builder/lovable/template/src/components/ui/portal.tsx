import * as React from "react";
import { createPortal } from "react-dom";
/**
 * Render children at document.body (or a given host).
 *
 * MOUNT-GATED, because `createPortal(document.body)` during server or
 * first-pass rendering is a crash — the portal renders nothing until the
 * component is mounted in a real DOM. One frame of absence, which is what
 * every portal library does quietly.
 *
 * WHY A PORTAL AT ALL: an overlay inside `overflow: hidden` or a
 * transformed ancestor is clipped or mispositioned (transform creates a
 * new containing block for fixed children — the floating-toolbar lesson).
 * Rendering at the body escapes every ancestor's clipping and stacking.
 *
 * The caveat that matters: a portal moves the DOM, not the React tree —
 * events still bubble through REACT's hierarchy, which is why
 * click-outside must check composedPath, not containment alone.
 */
export function Portal({ host, children }: { host?: Element | null; children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, host ?? document.body);
}
