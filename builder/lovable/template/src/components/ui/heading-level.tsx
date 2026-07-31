import * as React from "react";
/**
 * A heading that knows how deep it is.
 *
 * A reusable section cannot hard-code `<h2>`: the same component used at the
 * top of a page and inside a card produces a document that skips from h1 to
 * h3, or repeats h2 at four different depths. Screen-reader users navigate
 * by that outline, so a broken one is a page with no structure at all.
 *
 * `Section` steps the level; `Heading` renders at the current one, clamped to
 * h6 because there is no h7.
 */
const LevelContext = React.createContext(1);

export function Section({ children, className }: { children?: React.ReactNode; className?: string }) {
  const level = React.useContext(LevelContext);
  return (
    <LevelContext.Provider value={Math.min(6, level + 1)}>
      <section className={className}>{children}</section>
    </LevelContext.Provider>
  );
}

export function Heading({ children, className }: { children?: React.ReactNode; className?: string }) {
  const level = React.useContext(LevelContext);
  const Tag = `h${Math.min(6, Math.max(1, level))}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return <Tag className={className}>{children}</Tag>;
}
