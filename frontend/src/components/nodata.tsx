import { Download, FlaskConical, Plug } from "lucide-react";
import { useIncident } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { Button, StateBlock } from "./ui";

/** Shown instead of the incident screens until there is something to show: the app starts empty, the demo is opt-in. */
export function NoData() {
  const { t } = usePrefs();
  const { setDemo } = useIncident();
  const to = (hash: string) => () => { window.location.hash = hash; };
  return (
    <StateBlock kind="empty" title={t.emptyApp.title} body={t.emptyApp.body}
      action={<div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button variant="primary" icon={<FlaskConical size={15} aria-hidden />} onClick={() => setDemo(true)}>{t.emptyApp.demo}</Button>
        <Button icon={<Plug size={15} aria-hidden />} onClick={to("#/connect")}>{t.emptyApp.connect}</Button>
        <Button icon={<Download size={15} aria-hidden />} onClick={to("#/report")}>{t.emptyApp.imp}</Button>
      </div>} />
  );
}
