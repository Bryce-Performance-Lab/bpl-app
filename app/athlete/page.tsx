"use client";
import { useState } from "react";
import { addDays, iso, monday, totals, fromIso } from "@/lib/engine.js";
import { useAthlete, NotLinked } from "@/components/useAthlete";
import PlanTile from "@/components/PlanTile";

export default function AthleteHome() {
  const { athlete: a, plans, err } = useAthlete();
  const [start, setStart] = useState(() => monday(new Date()));
  if (err) return <p className="err">{err}</p>;
  if (a === undefined) return <p className="note">Loading…</p>;
  if (!a) return <NotLinked />;
  const today = iso(new Date()), days = Array.from({ length: 7 }, (_, i) => iso(addDays(start, i)));
  const wk = plans.filter(p => days.includes(p.date)), run = wk.filter(p => p.tag !== "Rest");
  const plannedKm = wk.reduce((s, p) => s + totals(a, p.steps).km, 0), doneKm = wk.reduce((s, p) => s + (p.analysis?.km || 0), 0);
  const thisWeek = days[0] === iso(monday(new Date()));
  return (
    <>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div className="lab">Week of {fromIso(days[0]).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}</div>
          <h1>{thisWeek ? "This week" : "Week view"}</h1>
        </div>
        <div style={{ textAlign: "right" }}><b style={{ fontSize: 20 }}>{doneKm.toFixed(1)}</b> <span className="note">of {plannedKm.toFixed(0)} km · {run.filter(p => p.analysis).length} of {run.length} sessions done</span></div>
      </div>
      <div className="row">
        <button className="btn sm" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>←</button>
        {!thisWeek && <button className="btn sm" onClick={() => setStart(monday(new Date()))}>This week</button>}
        <button className="btn sm" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}>→</button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {days.map(d => {
          const ps = plans.filter(p => p.date === d), dt = fromIso(d);
          return (
            <div key={d} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 44, textAlign: "center", paddingTop: 8, color: d === today ? "var(--royal)" : undefined }}>
                <div style={{ fontSize: 10, fontWeight: d === today ? 700 : 400 }}>{dt.toLocaleDateString("en-AU", { weekday: "short" }).toUpperCase()}</div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{dt.getDate()}</div>
              </div>
              <div className="stack" style={{ flex: 1, gap: 6 }}>
                {ps.length ? ps.map(p => <PlanTile key={p.id} p={p} athlete={a} today={today} big />)
                  : <div style={{ border: "1.5px dashed var(--line)", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "var(--muted)" }}>Rest day</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
