import { headline, mainStep, stepTarget, totals, dur } from "@/lib/engine.js";
import type { Athlete, Session } from "@/lib/data";

export function niceDate(iso: string, long = true) {
  return new Date(iso + "T00:00").toLocaleDateString("en-AU", long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
}

/** Tag, setting, title, date, the main set and its target. */
export default function SessionHead({ s, athlete }: { s: Session; athlete: Athlete }) {
  const m = mainStep(s.steps) || s.steps[0], t = totals(athlete, s.steps);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row"><span className="tag">{s.tag}</span>{s.setting && <span className="tag out">{s.setting}</span>}</div>
      <h1>{s.title || s.tag}</h1>
      <div className="note">{niceDate(s.date)}{s.steps.length ? ` · about ${t.km.toFixed(1)} km · ${dur(t.sec)}` : ""}</div>
      {m && <div style={{ fontSize: 26, fontWeight: 700 }}>{headline(s.steps)} <span style={{ fontSize: 14, color: m.zone === "T5" ? "var(--red)" : "var(--royal)" }}>{stepTarget(athlete, m)} · {m.zone}</span></div>}
    </div>
  );
}
