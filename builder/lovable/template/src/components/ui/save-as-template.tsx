import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * Turning the thing in front of you into a template, without taking its
 * contents with it.
 *
 * THE DATA QUESTION IS THE COMPONENT. Saving a filled-in thing as a template
 * and keeping the values is how a customer's name, a real price or somebody's
 * address ends up on every document made from it afterwards — the classic
 * leak, and it is silent because the template looks fine to the person who
 * made it. Keeping values is opt-in, per the caller's list, and off by default.
 *
 * IT SAYS WHAT WILL BE KEPT, in words, before the button. A checkbox labelled
 * "include content" leaves somebody guessing which content; naming the fields
 * makes the leak visible at the moment it can still be prevented.
 *
 * A DESCRIPTION IS ASKED FOR, because a template list six months later is a
 * column of names whose differences nobody remembers, and that is how three
 * near-identical templates accumulate.
 *
 * Name is required and trimmed — a template called " " is unfindable.
 */
export function SaveAsTemplate({ fields = [], onSave, onCancel, busy, className }: {
  /** Fields that currently hold values, offered for keeping. */
  fields?: { key: string; label: string; preview?: string }[];
  onSave: (v: { name: string; description?: string; keep: string[] }) => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keep, setKeep] = useState<string[]>([]);
  const ready = name.trim().length > 0;
  return (
    <form className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onSave({ name: name.trim(), description: description.trim() || undefined, keep }); }}>
      <div className="space-y-1">
        <label htmlFor="tpl-name" className="block text-sm font-medium">Template name</label>
        <input id="tpl-name" required value={name} onChange={(e) => setName(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="tpl-desc" className="block text-sm font-medium">
          What is it for? <span className="font-normal text-muted-foreground">optional</span>
        </label>
        <input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      {fields.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Keep any of these values?</legend>
          <p className="text-xs text-muted-foreground">
            Anything left unticked is emptied, so the template does not carry this one's details.
          </p>
          {fields.map((f) => (
            <label key={f.key} className="flex items-start gap-2 text-sm">
              <Checkbox checked={keep.includes(f.key)} className="mt-0.5"
                onCheckedChange={(v) => setKeep((k) => v === true ? [...k, f.key] : k.filter((x) => x !== f.key))} />
              <span className="min-w-0">
                {f.label}
                {f.preview && <span className="block truncate text-xs text-muted-foreground">{f.preview}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>Save template</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
