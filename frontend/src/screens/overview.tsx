import { Button, StateBlock } from "../components/ui";
import { useIncident } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { errText } from "../lib/errors";
import type { RouteName } from "../lib/router";
import { Home } from "./home";
import { ExpertHome } from "./expert";

/** Home screen (UI V2): the plain-language home in Simple mode, the unfolded layers of the same session in Expert mode. */
export function Overview({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, mode } = usePrefs();
  const inc = useIncident();
  if (inc.status === "loading") return <StateBlock kind="loading" title={t.loading} />;
  if (inc.status === "error") return <StateBlock kind="error" title={t.error} body={errText(t, inc.error)} action={<Button onClick={inc.reload}>{t.retry}</Button>} />;
  return mode === "simple" ? <Home go={go} /> : <ExpertHome go={go} />;
}
