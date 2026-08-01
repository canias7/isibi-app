import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choosing which version to read or run, with the unsupported ones marked.
 *
 * OUT-OF-SUPPORT VERSIONS STAY IN THE LIST, marked. Removing them means
 * somebody still running one finds no documentation at all and guesses — which
 * is worse than telling them plainly that they are on something unsupported and
 * what the current one is.
 *
 * "LATEST" AND THE ACTUAL NUMBER ARE BOTH SHOWN. A picker offering only
 * "latest" makes a bookmarked link mean something different next month; one
 * offering only numbers makes somebody pick a stale version by habit.
 *
 * THE VERSION SOMEBODY IS ACTUALLY RUNNING IS MARKED where the caller knows it.
 * Reading the docs for a version you are not on is the single commonest cause
 * of "the documentation is wrong".
 *
 * A NATIVE `<select>`, since this sits in a header and needs to work on a phone
 * with a long list.
 */
export type VersionOption = {
  id: string;
  label: string;
  state?: "latest" | "supported" | "unsupported" | "preview";
};

export function VersionPicker({ versions, value, onChange, running, label = "Version", id = "version", className }: {
  versions: VersionOption[];
  value: string;
  onChange: (id: string) => void;
  /** The version the reader is actually on. */
  running?: string;
  label?: string;
  id?: string;
  className?: string;
}) {
  const chosen = versions.find((v) => v.id === value);
  const SUFFIX = { latest: " (latest)", supported: "", unsupported: " (no longer supported)", preview: " (preview)" };
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <NativeSelect id={id} value={value} className="w-auto" onChange={(e) => onChange(e.target.value)}>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}{SUFFIX[v.state ?? "supported"]}{running === v.id ? " — you are on this" : ""}
          </option>
        ))}
      </NativeSelect>
      {chosen?.state === "unsupported" && (
        <p className="text-xs font-medium">
          This version is no longer supported and gets no fixes.
        </p>
      )}
      {chosen?.state === "preview" && (
        <p className="text-xs text-muted-foreground">This is a preview — it can still change.</p>
      )}
      {running && chosen && running !== chosen.id && (
        <p className="text-xs text-muted-foreground">
          You are running {versions.find((v) => v.id === running)?.label ?? running}, not this one.
        </p>
      )}
    </div>
  );
}
