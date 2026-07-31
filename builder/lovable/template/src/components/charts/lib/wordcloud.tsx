/**
 * Terms sized by frequency.
 *
 * Laid out by a deterministic spiral with real collision testing, NOT by
 * random placement: the same words must produce the same picture on every
 * render, or the chart cannot be screenshotted, diffed or described. Words that
 * cannot be placed are DROPPED rather than overlapped — an unreadable pile is
 * worse than a shorter list.
 *
 * Worth being honest about: a word cloud is a poor quantitative chart. Area
 * scales with the square of the font size, so a word twice as tall looks four
 * times as important. `bar-list` is the better answer whenever the numbers
 * actually matter; this is for texture.
 */
export type Term = { text: string; value: number };

export function WordCloud({
  terms,
  width = 420,
  height = 240,
  minSize = 11,
  maxSize = 40,
  rotate = false,
  max = 60,
  label,
}: {
  terms: Term[];
  width?: number;
  height?: number;
  minSize?: number;
  maxSize?: number;
  /** Alternate words to vertical. Denser, harder to read — off by default. */
  rotate?: boolean;
  max?: number;
  label?: string;
}) {
  if (!terms.length) return null;

  const ranked = [...terms].sort((a, b) => b.value - a.value).slice(0, max);
  const hi = ranked[0].value || 1;
  const lo = ranked[ranked.length - 1].value;
  const size = (v: number) => minSize + ((v - lo) / (hi - lo || 1)) * (maxSize - minSize);

  const placed: { text: string; x: number; y: number; s: number; rot: boolean; w: number; h: number }[] = [];
  const hits = (x: number, y: number, w: number, h: number) =>
    placed.some((p) => Math.abs(x - p.x) * 2 < w + p.w && Math.abs(y - p.y) * 2 < h + p.h);

  ranked.forEach((t, i) => {
    const s = size(t.value);
    const rot = rotate && i % 3 === 2;
    // 0.54em per character is a decent monospace-ish estimate for the label
    // fonts here; being slightly generous is what keeps words from touching.
    const tw = t.text.length * s * 0.56 + 6;
    const th = s * 1.15 + 4;
    const w = rot ? th : tw;
    const h = rot ? tw : th;

    let step = 0;
    let x = width / 2;
    let y = height / 2;
    while (step < 900) {
      const a = step * 0.35;
      const r = 3 + a * 1.6;
      x = width / 2 + Math.cos(a) * r;
      y = height / 2 + Math.sin(a) * r * 0.62;
      const inside = x - w / 2 >= 0 && x + w / 2 <= width && y - h / 2 >= 0 && y + h / 2 <= height;
      if (inside && !hits(x, y, w, h)) break;
      step++;
    }
    if (step < 900) placed.push({ text: t.text, x, y, s, rot, w, h });
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${placed.length} terms, most frequent ${ranked[0].text}`}>
      {placed.map((p, i) => (
        <text
          key={`${p.text}-${i}`}
          x={p.x}
          y={p.y}
          fontSize={p.s}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={p.rot ? `rotate(-90 ${p.x} ${p.y})` : undefined}
          className="fill-foreground"
          fillOpacity={0.35 + (p.s - minSize) / (maxSize - minSize || 1) * 0.65}
        >
          {p.text}
          <title>{p.text}</title>
        </text>
      ))}
    </svg>
  );
}

export const REVIEW_TERMS: Term[] = [
  { text: "friendly", value: 84 }, { text: "quick", value: 71 }, { text: "clean", value: 66 },
  { text: "fade", value: 58 }, { text: "price", value: 52 }, { text: "booking", value: 47 },
  { text: "beard", value: 44 }, { text: "chat", value: 39 }, { text: "parking", value: 35 },
  { text: "coffee", value: 31 }, { text: "waiting", value: 28 }, { text: "music", value: 24 },
  { text: "kids", value: 22 }, { text: "towel", value: 19 }, { text: "colour", value: 17 },
  { text: "early", value: 15 }, { text: "tidy", value: 14 }, { text: "local", value: 12 },
  { text: "sharp", value: 11 }, { text: "advice", value: 9 },
];
