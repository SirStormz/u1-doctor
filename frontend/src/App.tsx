import { useEffect, useState } from "react";
import { Shell } from "./components/shell";
import { IncidentProvider } from "./lib/data";
import { PrefsProvider, usePrefs } from "./lib/prefs";
import { useLanding, useRoute } from "./lib/router";
import { GoldenOverlay, Landing } from "./screens/landing";
import { Evidence, Findings } from "./screens/evidence";
import { Connect, Explorer, Replay, SettingsScreen, Welcome } from "./screens/misc";
import { Overview } from "./screens/overview";
import { Report } from "./screens/report";
import { Symptoms } from "./screens/symptoms";
import { Timeline } from "./screens/timeline";

function Screens() {
  const [route, go] = useRoute();
  const [replay, setReplay] = useState(false);
  const landing = useLanding();
  const [gold, setGold] = useState(false);
  const { t } = usePrefs();
  useEffect(() => {
    if (landing) return;
    const on = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) setGold((g) => !g); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [landing]);
  if (landing) return <Landing go={go} />;
  const screen = (() => {
    switch (route.name) {
      case "welcome": return <Welcome go={go} />;
      case "connect": return <Connect />;
      case "overview": return <Overview go={go} />;
      case "explorer": return <Explorer param={route.param} />;
      case "symptoms": return <Symptoms />;
      case "timeline": return <Timeline />;
      case "findings": return <Findings go={go} />;
      case "evidence": return <Evidence param={route.param} go={go} />;
      case "replay": return <Replay onMode={setReplay} />;
      case "report": return <Report />;
      case "settings": return <SettingsScreen />;
    }
  })();
  return <><Shell route={route.name} go={go} replay={replay && route.name === "replay"}>{screen}</Shell><GoldenOverlay on={gold} label={t.landing.spiral} /></>;
}

export function App() {
  return (
    <PrefsProvider>
      <IncidentProvider>
        <Screens />
      </IncidentProvider>
    </PrefsProvider>
  );
}
