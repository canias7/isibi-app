import * as React from "react";
/**
 * Strips the formatting out of a paste.
 *
 * Pasting from Word or a web page carries fonts, colours and inline styles
 * that then override the site's own — the single commonest way a CMS page
 * ends up with 11pt Calibri in the middle of it. This takes the plain text
 * and drops the rest.
 *
 * `text/plain` is read from the clipboard rather than the HTML being
 * sanitised, because sanitising means keeping a list of what is allowed and
 * that list is always one tag out of date.
 *
 * Returns a handler for a textarea or an input. For a contentEditable, use
 * `onPasteContentEditable`, which also has to insert the text itself since
 * preventing the default would otherwise drop the paste entirely.
 */
export function usePasteClean(onText?: (text: string) => void) {
  const onPaste = React.useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!onText) return;
    e.preventDefault();
    onText(text);
  }, [onText]);

  const onPasteContentEditable = React.useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData("text/plain") ?? "";
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    sel.deleteFromDocument();
    sel.getRangeAt(0).insertNode(document.createTextNode(text));
    sel.collapseToEnd();
  }, []);

  return { onPaste, onPasteContentEditable };
}
