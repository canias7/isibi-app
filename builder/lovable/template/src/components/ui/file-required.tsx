import { cn } from "@/lib/utils";
/**
 * A file field that is compulsory, marked before it blocks anything.
 *
 * REQUIRED FILE INPUTS ARE UNIQUELY EASY TO MISS. A blank text field looks
 * empty; a file field with nothing chosen looks exactly like one that is done,
 * because there is nothing to type into. Somebody fills in ten fields, submits,
 * and is refused for the one control that gave no sign of being unfinished.
 *
 * IT NAMES THE ACCEPTED TYPES IN WORDS. "application/pdf,image/jpeg" is what
 * the browser needs and not what a person reads — "a PDF or a photo" is, and
 * type refusals are otherwise silent: the file simply cannot be selected, with
 * no explanation.
 *
 * MET IS SHOWN AS THE FILENAME, which is the only real confirmation. A tick
 * beside "uploaded" does not say WHICH file, and attaching the wrong document
 * is the commonest mistake once a field is satisfied.
 *
 * `aria-describedby` ties the requirement to the input, so it is announced when
 * the field is reached rather than being loose text nearby.
 */
export function FileRequired({ label, id, accept, acceptWords, filename, onFile, onClear, hint, className }: {
  label: string;
  id: string;
  /** The browser's accept attribute. */
  accept?: string;
  /** The same thing in words — "a PDF or a photo". */
  acceptWords?: string;
  /** The chosen file, when there is one. */
  filename?: string;
  onFile: (file: File) => void;
  onClear?: () => void;
  hint?: string;
  className?: string;
}) {
  const done = Boolean(filename);
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">required</span>
      </label>
      {done ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 truncate">{filename}</span>
          {onClear && (
            <button type="button" onClick={onClear} className="shrink-0 text-xs underline underline-offset-2">
              Choose a different one
            </button>
          )}
        </p>
      ) : (
        <input id={id} type="file" required accept={accept} aria-describedby={`${id}-help`}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm" />
      )}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {acceptWords && <span>{acceptWords}. </span>}
        {hint}
      </p>
    </div>
  );
}
