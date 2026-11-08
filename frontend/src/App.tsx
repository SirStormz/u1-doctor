import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "./components/shell";
import { IncidentProvider } from "./lib/data";
import { isGoldKey } from "./lib/keys";
import { PrefsProvider, usePrefs } from "./lib/prefs";
import { useLanding, useRoute } from "./lib/router";

// Route-level code splitting: the shell (header, menu, palette) loads at once, each screen module on first visit.
const Landing = lazy(() => import("./screens/landing").then((m) => ({ default: m.Landing })));
const GoldenOverlay = lazy(() => import("./screens/landing").then((m) => ({ default: m.GoldenOverlay })));
const Findings = lazy(() => import("./screens/evidence").then((m) => ({ default: m.Findings })));
const Evidence = lazy(() => import("./screens/evidence").then((m) => ({ default: m.Evidence })));
const Welcome = lazy(() => import("./screens/misc").then((m) => ({ default: m.Welcome })));
const Connect = lazy(() => import("./screens/misc").then((m) => ({ default: m.Connect })));
const Explorer = lazy(() => import("./screens/misc").then((m) => ({ default: m.Explorer })));
const Replay = lazy(() => import("./screens/misc").then((m) => ({ default: m.Replay })));
const SettingsScreen = lazy(() => import("./screens/misc").then((m) => ({ default: m.SettingsScreen })));
const Overview = lazy(() => import("./screens/overview").then((m) => ({ default: m.Overview })));
const Report = lazy(() => import("./screens/report").then((m) => ({ default: m.Report })));
const Symptoms = lazy(() => import("./screens/symptoms").then((m) => ({ default: m.Symptoms })));
const Timeline = lazy(() => import("./screens/timeline").then((m) => ({ default: m.Timeline })));

function Screens() {
  const [route, go] = useRoute();
  const [replay, setReplay] = useState(false);
  const landing = useLanding();
  const [gold, setGold] = useState(false);
  const { t, onboarded } = usePrefs();
  useEffect(() => {
    if (landing || !onboarded) return; // no page shortcut while the first-run dialog is open
    const on = (e: KeyboardEvent) => { if (isGoldKey(e)) { e.preventDefault(); setGold((g) => !g); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [landing, onboarded]);
  if (landing) return <Suspense fallback={null}><Landing go={go} /></Suspense>;
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
  return <><Shell route={route.name} go={go} replay={replay && route.name === "replay"}><Suspense fallback={null}>{screen}</Suspense></Shell><Suspense fallback={null}><GoldenOverlay on={gold} label={t.landing.spiral} /></Suspense></>;
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
