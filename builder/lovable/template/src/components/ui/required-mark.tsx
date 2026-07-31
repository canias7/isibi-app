/** The asterisk, announced properly rather than read out as punctuation. */
export function RequiredMark() {
  return <span className="text-muted-foreground"><span aria-hidden="true">*</span><span className="sr-only">required</span></span>;
}
