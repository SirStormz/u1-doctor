import { Delete, X } from "lucide-react";
import { usePrefs } from "../lib/prefs";

/** Digits of a code typed on the keypad, grouped by four with dashes (dddd-dddd-dddd-dddd), at most 16 digits. */
export function keyCode(value: string, key: string): string {
  let d = value.replace(/\D/g, "").slice(0, 16);
  if (key === "back") d = d.slice(0, -1);
  else if (key === "clear") d = "";
  else if (/^\d$/.test(key) && d.length < 16) d += key;
  return d.replace(/(\d{4})(?=\d)/g, "$1-");
}

/** Numeric keypad that types an error code into the code field (Console theme shows it; the field works the same without it). */
export function CodeKeypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = usePrefs();
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
  return (
    <div className="kp" role="group" aria-label={t.sig.keypad}>
      {keys.map((k) => (
        <button key={k} type="button" className="kp-key" data-k={k} aria-label={k === "back" ? t.sig.erase : k === "clear" ? t.sig.clear : undefined} onClick={() => onChange(keyCode(value, k))}>
          {k === "back" ? <Delete size={18} aria-hidden /> : k === "clear" ? <X size={18} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}
