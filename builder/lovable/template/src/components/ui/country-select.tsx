import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choose a country.
 *
 * Names come from `Intl.DisplayNames`, so the list is in the reader's own
 * language and stays correct as countries are renamed — a hardcoded list of
 * 250 English names is 8 KB that goes stale and reads as foreign to most of
 * the world.
 *
 * `priority` puts a handful at the top for a business that mostly ships to a
 * few places, and they are REPEATED in the full list below rather than
 * removed from it: somebody scrolling to G for Germany should find it there.
 *
 * ISO 3166-1 alpha-2 codes in and out — never the display name, which changes
 * with the reader's language.
 */
const CODES = ["AE","AR","AT","AU","BE","BG","BR","CA","CH","CL","CN","CO","CY","CZ","DE","DK","EE","EG","ES","FI","FR","GB","GR","HK","HR","HU","ID","IE","IL","IN","IS","IT","JP","KE","KR","LT","LU","LV","MA","MT","MX","MY","NG","NL","NO","NZ","PE","PH","PL","PT","RO","RS","SA","SE","SG","SI","SK","TH","TR","TW","UA","US","VN","ZA"];
export function CountrySelect({ value, onChange, id, priority = ["GB", "US", "IE"], className }: {
  value: string; onChange: (code: string) => void; id?: string;
  priority?: string[]; className?: string;
}) {
  let nameOf: (c: string) => string;
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" });
    nameOf = (c) => dn.of(c) ?? c;
  } catch { nameOf = (c) => c; }
  const all = CODES.map((c) => ({ code: c, label: nameOf(c) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const top = priority.map((c) => ({ code: c, label: nameOf(c) })).filter((x) => CODES.includes(x.code));
  return (
    <NativeSelect id={id} value={value} autoComplete="country" className={cn(className)}
      onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a country</option>
      {top.length > 0 && top.map((c) => <option key={"p-" + c.code} value={c.code}>{c.label}</option>)}
      {top.length > 0 && <option disabled>──────────</option>}
      {all.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
    </NativeSelect>
  );
}
