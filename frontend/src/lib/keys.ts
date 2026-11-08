/** True when a key press is meant for a text field, a list or an editable area, not for a page shortcut. */
export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest('[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]'));

/** Alt+G toggles the golden construction (WCAG 2.1.4: no single-key shortcut). `code` is used because Alt+G types "©" on macOS. */
export const isGoldKey = (e: KeyboardEvent) =>
  e.altKey && !e.ctrlKey && !e.metaKey && (e.code === "KeyG" || e.key.toLowerCase() === "g") && !isTyping(e.target);
