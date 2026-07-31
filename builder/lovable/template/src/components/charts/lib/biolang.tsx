/** Biology, genetics and language — trees, sequences and text differences. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------- phylo tree */
type Clade = { label?: string; length?: number; children?: Clade[] };

/**
 * A phylogram — branch LENGTH carries evolutionary distance, so the tips do
 * not line up, and that is the point. A cladogram with equal branches shows
 * topology only; this shows how far apart things actually are.
 */
export function PhylogeneticTree({
  root, height = 260, label,
}: {
  root: Clade; height?: number; label?: string;
}) {
  const tips: { clade: Clade; depth: number; row: number }[] = [];
  let row = 0;
  const walk = (c: Clade, depth: number): number => {
    const d = depth + (c.length ?? 0);
    if (!c.children?.length) { tips.push({ clade: c, depth: d, row: row++ }); return row - 1; }
    const kids = c.children.map((k) => walk(k, d));
    return (kids[0] + kids[kids.length - 1]) / 2;
  };
  walk(root, 0);
  if (!tips.length) return null;
  const maxDepth = Math.max(...tips.map((t) => t.depth)) || 1;
  const n = tips.length;
  const x = (d: number) => (d / maxDepth) * 74;
  const y = (r: number) => ((r + 0.5) / n) * 100;

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const rowOf = (c: Clade, depth: number): number => {
    const d = depth + (c.length ?? 0);
    if (!c.children?.length) return tips.find((t) => t.clade === c)!.row;
    const rs = c.children.map((k) => {
      const kr = rowOf(k, d);
      edges.push({ x1: x(d), y1: y(kr), x2: x(d + (k.length ?? 0)), y2: y(kr) });
      return kr;
    });
    edges.push({ x1: x(d), y1: y(rs[0]), x2: x(d), y2: y(rs[rs.length - 1]) });
    return (rs[0] + rs[rs.length - 1]) / 2;
  };
  rowOf(root, 0);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${n} taxa`}>
        {edges.map((e, i) => (
          <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        ))}
      </svg>
      <div className="relative -mt-1" style={{ height: 0 }} />
      <div className="relative" style={{ marginTop: -height, height }}>
        {tips.map((t) => (
          <span key={t.clade.label} className="absolute text-[10px]"
            style={{ left: `${x(t.depth) + 1.5}%`, top: `${y(t.row)}%`, transform: "translateY(-50%)" }}>
            {t.clade.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Branch length is distance, so the tips do not line up · {n} taxa
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- punnett square */
/**
 * The cross of two parents' alleles, with the phenotype ratio COUNTED from
 * the grid rather than stated — 3:1 written under a grid that is not 3:1 is
 * the thing this catches.
 */
export function PunnettSquare({
  a, b, dominant, size = 260, label,
}: {
  /** each parent's two alleles, e.g. ["A","a"] */ a: [string, string]; b: [string, string];
  /** the allele that masks the other */ dominant: string;
  size?: number; label?: string;
}) {
  const cells = b.map((bi) => a.map((ai) => [ai, bi].sort((p, q) => (p === dominant ? -1 : q === dominant ? 1 : p.localeCompare(q))).join("")));
  const flat = cells.flat();
  const shows = flat.filter((g) => g.includes(dominant)).length;

  return (
    <div className="w-full">
      <div className="grid gap-px" style={{ gridTemplateColumns: `auto repeat(${a.length}, 1fr)`, maxWidth: size }}>
        <span />
        {a.map((ai) => <span key={ai} className="pb-1 text-center text-[11px] font-semibold">{ai}</span>)}
        {cells.map((rowCells, ri) => (
          <div key={ri} className="contents">
            <span className="pr-1.5 text-[11px] font-semibold self-center">{b[ri]}</span>
            {rowCells.map((g, ci) => {
              const dom = g.includes(dominant);
              return (
                <div key={ci} className="flex aspect-square items-center justify-center border text-[12px] font-medium"
                  style={{
                    borderColor: "var(--border)",
                    background: dom ? TONE : "var(--background)",
                    color: dom ? "var(--background)" : "var(--foreground)",
                  }}>
                  {g}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Filled squares show the dominant trait · {shows}:{flat.length - shows} of {flat.length}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ sequence logo */
/**
 * A sequence logo: letter HEIGHT is information content in bits, which is
 * what distinguishes a conserved position from a variable one. Frequency
 * alone would draw a 4-way tie as tall as a fully conserved base.
 */
export function SequenceLogo({
  positions, alphabetSize = 4, height = 190, label,
}: {
  /** per position, the frequency of each letter (values sum to 1) */
  positions: Record<string, number>[];
  alphabetSize?: number; height?: number; label?: string;
}) {
  if (!positions.length) return null;
  const maxBits = Math.log2(alphabetSize);
  const info = positions.map((p) => {
    const h = -Object.values(p).reduce((s, f) => (f > 0 ? s + f * Math.log2(f) : s), 0);
    return Math.max(0, maxBits - h);
  });

  // Drawn in SVG so each glyph can be scaled INDEPENDENTLY in x and y: a letter
  // is squeezed to exactly its column width and stretched to its information
  // height. Sizing an HTML glyph by font-size scales both together, so a tall
  // stack spills across its neighbours — which is what the first version did.
  const COL = 10, H = 100;
  const W = positions.length * COL;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `motif over ${positions.length} positions`}>
        {positions.map((p, i) => {
          const stack = Object.entries(p).filter(([, f]) => f > 0.001).sort((a, b) => a[1] - b[1]);
          let y = H;
          return stack.map(([letter, f]) => {
            const h = (f * info[i] / maxBits) * H;
            y -= h;
            // Below about 1% of the panel a glyph squashes into an unreadable
            // smear that reads as an artefact rather than as "almost no signal".
            if (h < 1.2) return null;
            // A 10-unit em box scaled to (COL × h); dy 0.78 puts the baseline
            // at the bottom of that box.
            return (
              <text key={letter} x={0} y={0} fontSize={10} fontWeight={700} textAnchor="middle"
                fill={TONE} fillOpacity={0.4 + f * 0.6}
                transform={`translate(${i * COL + COL / 2} ${y + h}) scale(${COL / 7.2} ${h / 7.8})`}>
                {letter}
              </text>
            );
          });
        })}
      </svg>
      <div className="mt-1 flex">
        {positions.map((_, i) => <span key={i} className="flex-1 text-center text-[9px] text-muted-foreground">{i + 1}</span>)}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground" aria-label={label}>
        Height is information in bits, up to {maxBits} · a tall stack is a conserved position
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ genome track */
/** Features along a coordinate, on strand-separated lanes. */
export function GenomeTrack({
  length, features, height = 150, label,
}: {
  length: number;
  features: { start: number; end: number; label?: string; strand: "+" | "-"; kind?: string }[];
  height?: number; label?: string;
}) {
  if (!features.length) return null;
  const pct = (v: number) => (v / length) * 100;
  const lanes = { "+": features.filter((f) => f.strand === "+"), "-": features.filter((f) => f.strand === "-") };

  const lane = (strand: "+" | "-") => (
    <div className="relative h-9">
      {[...lanes[strand]].sort((a, b) => a.start - b.start).map((f, i, lane) => {
        const w = pct(f.end - f.start);
        // A short feature cannot hold its own name — inside the block it truncates
        // to "y…" and says nothing. So it goes BESIDE the block, but only where
        // there is actually room: placed blindly it lands under the NEXT feature,
        // which is a different unreadable label rather than a fix.
        const gapAfter = i + 1 < lane.length ? pct(lane[i + 1].start - f.end) : 100 - pct(f.end);
        const gapBefore = i > 0 ? pct(f.start - lane[i - 1].end) : pct(f.start);
        const nearEnd = pct(f.start) + w > 78;
        const room = nearEnd ? gapBefore : gapAfter;
        const inside = w >= 7 || room < 7;
        return (
          <div key={i} className="absolute top-1.5 h-6" style={{ left: `${pct(f.start)}%`, width: `${w}%` }}
            title={`${f.label ?? ""} ${f.start}–${f.end} (${strand})`}>
            <div className="flex h-full items-center justify-center overflow-hidden rounded-[2px] px-1" style={{ background: TONE }}>
              {inside ? <span className="truncate text-[9px] font-medium" style={{ color: "var(--background)" }}>{f.label}</span> : null}
            </div>
            {!inside && f.label ? (
              <span className="absolute top-1/2 -translate-y-1/2 text-[9px] whitespace-nowrap text-muted-foreground"
                style={nearEnd ? { right: "calc(100% + 3px)" } : { left: "calc(100% + 3px)" }}>{f.label}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full" style={{ minHeight: height }} role="img" aria-label={label ?? `${features.length} features`}>
      <div className="mb-0.5 text-[10px] text-muted-foreground">+ strand →</div>
      {lane("+")}
      <div className="relative h-4 border-y border-border">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="absolute top-0.5 -translate-x-1/2 text-[9px] text-muted-foreground" style={{ left: `${f * 100}%` }}>
            {Math.round(length * f).toLocaleString()}
          </span>
        ))}
      </div>
      {lane("-")}
      <div className="text-[10px] text-muted-foreground">← − strand</div>
    </div>
  );
}

/* ---------------------------------------------------------------- food web */
/**
 * Who eats whom, arranged by TROPHIC LEVEL — the vertical position is the
 * meaning, so a producer can never appear above a predator.
 */
export function FoodWeb({
  species, links, height = 260, label,
}: {
  species: { name: string; level: number }[];
  /** prey → predator */ links: { from: string; to: string }[];
  height?: number; label?: string;
}) {
  if (!species.length) return null;
  const levels = [...new Set(species.map((s) => s.level))].sort((a, b) => a - b);
  const pos = new Map<string, { x: number; y: number }>();
  levels.forEach((lv) => {
    const row = species.filter((s) => s.level === lv);
    row.forEach((s, i) => pos.set(s.name, {
      x: ((i + 0.5) / row.length) * 100,
      y: 100 - ((levels.indexOf(lv) + 0.5) / levels.length) * 100,
    }));
  });

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${species.length} species over ${levels.length} trophic levels`}>
        {links.map((l, i) => {
          const a = pos.get(l.from), b = pos.get(l.to);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={TONE} strokeWidth={1} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="relative" style={{ marginTop: -height, height }}>
        {species.map((s) => {
          const p = pos.get(s.name)!;
          return (
            <span key={s.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[10px] whitespace-nowrap"
              style={{ left: `${p.x}%`, top: `${p.y}%`, background: "var(--background)", borderColor: TONE }}>
              {s.name}
            </span>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Height is trophic level · producers at the bottom, top predators above
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- syntax tree */
/** A constituency parse — phrase labels above, words at the leaves. */
export function SyntaxTree({
  root, height = 220, label,
}: {
  root: { tag: string; word?: string; children?: { tag: string; word?: string; children?: unknown[] }[] };
  height?: number; label?: string;
}) {
  type Node = { tag: string; word?: string; children?: Node[] };
  const leaves: Node[] = [];
  let depth = 0;
  const measure = (n: Node, d: number) => {
    depth = Math.max(depth, d);
    if (!n.children?.length) { leaves.push(n); return; }
    n.children.forEach((c) => measure(c, d + 1));
  };
  measure(root as Node, 0);
  if (!leaves.length) return null;
  const cols = leaves.length;

  const place = (n: Node, d: number): { x: number; y: number } => {
    const y = (d / (depth || 1)) * 82;
    if (!n.children?.length) {
      const x = ((leaves.indexOf(n) + 0.5) / cols) * 100;
      return { x, y };
    }
    const kids = n.children.map((c) => place(c, d + 1));
    return { x: (kids[0].x + kids[kids.length - 1].x) / 2, y };
  };

  const nodes: { n: Node; x: number; y: number }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const walk = (n: Node, d: number) => {
    const p = place(n, d);
    nodes.push({ n, x: p.x, y: p.y });
    n.children?.forEach((c) => {
      const cp = place(c, d + 1);
      edges.push({ x1: p.x, y1: p.y + 3, x2: cp.x, y2: cp.y - 2 });
      walk(c, d + 1);
    });
  };
  walk(root as Node, 0);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `parse of ${leaves.map((l) => l.word ?? l.tag).join(" ")}`}>
          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={TONE} strokeWidth={1} strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {nodes.map((nd, i) => (
          <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold"
            style={{ left: `${nd.x}%`, top: `${nd.y}%` }}>{nd.n.tag}</span>
        ))}
        {leaves.map((l, i) => (
          <span key={`w${i}`} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${((i + 0.5) / cols) * 100}%`, top: "92%" }}>{l.word}</span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- diff strip */
/** Added, removed and unchanged lines as one proportional strip per file. */
export function DiffStrip({
  files, label,
}: {
  files: { name: string; added: number; removed: number; context: number }[]; label?: string;
}) {
  if (!files.length) return null;
  const widest = Math.max(...files.map((f) => f.added + f.removed + f.context));
  const totalA = files.reduce((s, f) => s + f.added, 0);
  const totalR = files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="w-full space-y-1.5" role="img" aria-label={label ?? `+${totalA} −${totalR} across ${files.length} files`}>
      {files.map((f) => {
        const total = f.added + f.removed + f.context;
        return (
          <div key={f.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px]">{f.name}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">+{f.added} −{f.removed}</span>
            </div>
            <div className="mt-0.5 flex h-2.5 overflow-hidden rounded-[2px]" style={{ width: `${(total / widest) * 100}%` }}>
              <span style={{ width: `${(f.added / total) * 100}%`, background: TONE }} title={`${f.added} added`} />
              <span style={{ width: `${(f.removed / total) * 100}%`, background: TONE, opacity: 0.45,
                backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)" }} title={`${f.removed} removed`} />
              <span style={{ width: `${(f.context / total) * 100}%`, background: "var(--muted)" }} title={`${f.context} unchanged`} />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground">
        Solid added · hatched removed · pale unchanged · bar width is file size, so a big change to a big file reads as one
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- edit matrix */
/**
 * The Levenshtein dynamic-programming table with the traceback drawn on it —
 * the distance is the bottom-right cell, computed here, not supplied.
 */
export function EditMatrix({
  a, b, size = 320, label,
}: {
  a: string; b: string; size?: number; label?: string;
}) {
  if (!a || !b) return null;
  const n = a.length, m = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, j) => Array.from({ length: n + 1 }, (_, i) => (j === 0 ? i : i === 0 ? j : 0)));
  for (let j = 1; j <= m; j++) {
    for (let i = 1; i <= n; i++) {
      d[j][i] = Math.min(d[j - 1][i] + 1, d[j][i - 1] + 1, d[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const path = new Set<string>();
  let i = n, j = m;
  while (i > 0 || j > 0) {
    path.add(`${j}-${i}`);
    if (i > 0 && j > 0 && d[j][i] === d[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { i--; j--; }
    else if (i > 0 && d[j][i] === d[j][i - 1] + 1) i--;
    else j--;
  }
  path.add("0-0");
  const max = d[m][n] || 1;

  return (
    <div className="w-full overflow-x-auto">
      <table className="border-collapse text-[10px] tabular-nums" style={{ maxWidth: size }}>
        <tbody>
          <tr>
            <td /><td />
            {[...a].map((ch, ix) => <td key={ix} className="px-1 text-center font-semibold">{ch}</td>)}
          </tr>
          {d.map((row, rj) => (
            <tr key={rj}>
              <td className="pr-1 text-right font-semibold">{rj === 0 ? "" : b[rj - 1]}</td>
              {row.map((v, ri) => {
                const on = path.has(`${rj}-${ri}`);
                return (
                  <td key={ri} className="h-5 w-5 border text-center"
                    style={{
                      borderColor: "var(--border)",
                      background: on ? TONE : `color-mix(in oklch, ${TONE} ${Math.round((v / (max * 1.6)) * 45)}%, transparent)`,
                      color: on ? "var(--background)" : "var(--foreground)",
                      fontWeight: on ? 700 : 400,
                    }}>{v}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Edit distance {d[m][n]} · the filled cells are the cheapest route, read from the bottom right
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- readability */
/**
 * Sentence length against syllables per word, with the reading-ease grade
 * COMPUTED per document — a scatter that plots the two inputs of the score
 * and then states the score they produce.
 */
export function ReadabilityPlot({
  docs, height = 240, label,
}: {
  docs: { name: string; wordsPerSentence: number; syllablesPerWord: number }[];
  height?: number; label?: string;
}) {
  if (!docs.length) return null;
  const ease = (d: { wordsPerSentence: number; syllablesPerWord: number }) =>
    206.835 - 1.015 * d.wordsPerSentence - 84.6 * d.syllablesPerWord;
  const grade = (e: number) =>
    e >= 90 ? "very easy" : e >= 70 ? "easy" : e >= 60 ? "plain" : e >= 50 ? "fairly hard" : e >= 30 ? "difficult" : "very difficult";
  const xLo = 4, xHi = Math.max(30, ...docs.map((d) => d.wordsPerSentence)) * 1.05;
  const yLo = 1.1, yHi = Math.max(2.2, ...docs.map((d) => d.syllablesPerWord)) * 1.03;
  const px = (v: number) => ((v - xLo) / (xHi - xLo)) * 100;
  const py = (v: number) => 100 - ((v - yLo) / (yHi - yLo)) * 100;

  // Iso-ease contours, so the reader can see which way is "harder".
  const iso = [90, 70, 50, 30].map((e) => {
    const pts: string[] = [];
    for (let w = xLo; w <= xHi; w += (xHi - xLo) / 40) {
      const s = (206.835 - 1.015 * w - e) / 84.6;
      if (s >= yLo && s <= yHi) pts.push(`${px(w)},${py(s)}`);
    }
    return { e, pts: pts.join(" ") };
  });

  // Labels pushed apart top-to-bottom, or two documents with similar syllable
  // counts print their names on top of each other.
  const MIN_GAP = 11;
  const placed = docs
    .map((d) => ({ d, x: px(d.wordsPerSentence), y: py(d.syllablesPerWord), ly: py(d.syllablesPerWord) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].ly - placed[i - 1].ly < MIN_GAP) placed[i].ly = placed[i - 1].ly + MIN_GAP;
  }

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${docs.length} documents by reading ease`}>
          {iso.map((c) => (
            <polyline key={c.e} points={c.pts} fill="none" stroke={TONE}
              strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* HTML dots: a <circle> in a preserveAspectRatio="none" viewBox comes
            out an ellipse, which reads as a different kind of mark entirely. */}
        {placed.map((p) => (
          <span key={p.d.name} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: TONE, opacity: 0.85 }} />
        ))}
        {placed.map((p) => {
          // A label on the right of a dot near the right edge gets clamped back
          // ON TOP of that dot. Past halfway it sits to the LEFT instead.
          const leftSide = p.x > 55;
          return (
            <span key={`l-${p.d.name}`} className="absolute text-[10px] whitespace-nowrap"
              style={{
                ...(leftSide ? { right: `${100 - p.x + 2.5}%` } : { left: `${p.x + 2.5}%` }),
                top: `${Math.min(94, p.ly)}%`,
                transform: "translateY(-50%)",
              }}>
              {p.d.name}
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{xLo} words/sentence</span><span>{Math.round(xHi)}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {docs.map((d) => {
          const e = ease(d);
          return <p key={d.name} className="text-[10px] text-muted-foreground">{d.name} · ease {Math.round(e)} · {grade(e)}</p>;
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">Dashed lines are equal reading ease · up and right is harder</p>
    </div>
  );
}
