/** "a, b and c" — with the right conjunction for the visitor's language. */
export function ListFormat({ items, type = "conjunction", className }: {
  items: string[]; type?: "conjunction" | "disjunction"; className?: string;
}) {
  const text = new Intl.ListFormat(undefined, { style: "long", type }).format(items);
  return <span className={className}>{text}</span>;
}
