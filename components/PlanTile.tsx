import Link from "next/link";
import { fmt, headline, stepTarget, mainStep } from "@/lib/engine.js";
import { TAG_COLOUR, type Athlete, type Plan } from "@/lib/data";
import { weatherChip } from "@/lib/weather";

/** A session tile that opens the session. */
export default function PlanTile({ p, athlete, today, big }: { p: Plan; athlete: Athlete; today: string; big?: boolean }) {
  const m = mainStep(p.steps) || p.steps[0], an = p.analysis;
  const status = an ? "✓ Done" : p.date === today ? "TODAY" : p.date < today ? "Not logged" : "";
  return (
    <Link href={`/athlete/session/${p.id}`} className="scard" style={{ borderLeftColor: TAG_COLOUR[p.tag] || "var(--z2)", padding: big ? "10px 12px" : undefined, gap: 3 }}>
      <span className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: big ? 13.5 : 12 }}>{p.title}</b><span style={{ fontSize: 11, fontWeight: 700, color: an ? "var(--good)" : p.date < today ? "var(--muted)" : "var(--royal)" }}>{status}</span></span>
      {an ? (
        <>
          <span style={{ fontWeight: 700 }}>{an.plannedReps ? `${an.onTarget}/${an.plannedReps} reps on target · ` : ""}{an.km.toFixed(1)} km · {fmt(an.pace)}/km avg</span>
          {p.activity?.weather && <span className="note">{weatherChip(p.activity.weather)}</span>}
        </>
      ) : (
        <>
          <span style={{ fontSize: big ? 20 : 13, fontWeight: 700 }}>{headline(p.steps)}</span>
          {m && <span className="note">{stepTarget(athlete, m)} · {m.zone}</span>}
        </>
      )}
    </Link>
  );
}
