"use client";
import { compareData, dur, fmt, miniTrendSVG, tagOf } from "@/lib/engine.js";
import type { Athlete, Plan } from "@/lib/data";

/** This session against the last 6 similar ones (same tag + setting, main set in the same zone). */
export default function CompareView({ all, ses, athlete }: { all: Plan[]; ses: Plan; athlete: Athlete }) {
  const c = compareData(all, ses, athlete);
  if (!c) return <p className="note">This session has no run data to compare yet.</p>;
  if (!c.prev.length) return <p className="note" style={{ margin: 0 }}>No earlier sessions match yet ({c.crit}). Once there are more {tagOf(ses.tag).toLowerCase()} sessions with run data, the last 6 appear here.</p>;
  const trends = [
    miniTrendSVG(c.rows, "rep", "Avg work pace (faster ↑)", (v: number) => fmt(v), true),
    miniTrendSVG(c.rows, "hr", "Avg rep HR (bpm)", (v: number) => String(Math.round(v)), false),
    miniTrendSVG(c.rows, "lac", "Peak lactate (mmol/L)", (v: number) => v.toFixed(1), false),
    miniTrendSVG(c.rows, "rpe", "RPE", (v: number) => v.toFixed(1).replace(/\.0$/, ""), false),
  ].filter(Boolean);
  return (
    <div className="stack">
      <p className="note" style={{ margin: 0 }}>Compared with the last {c.prev.length} similar session{c.prev.length > 1 ? "s" : ""}: {c.crit}. Work pace is the average across all reps; distance reps use their time over the planned distance, not GPS.</p>
      <div className="chips">{c.chips.map((x: any) => <div key={x.label} className={"chip " + x.cls}><span className="lab">{x.label}</span><b>{x.value}</b><span className="note">{x.note}</span></div>)}</div>
      <div className="trends">{trends.map((t, i) => <div key={i} dangerouslySetInnerHTML={{ __html: t }} />)}</div>
      <div className="rtab-wrap"><table className="rtab">
        <thead><tr><th>DATE</th><th>MAIN SET</th><th>REPS</th><th>WORK TIME</th><th>WORK PACE</th><th>HR</th><th>RPE</th><th>LACTATE</th><th>ON TARGET</th></tr></thead>
        <tbody>{c.rows.map((r: any) => (
          <tr key={r.id} className={r.me ? "me" : ""}>
            <td>{r.me ? "This session" : r.date.slice(8) + "/" + r.date.slice(5, 7) + "/" + r.date.slice(2, 4)}</td>
            <td className="note">{r.structure}</td><td>{r.hasSet ? r.n + "/" + r.planned : "–"}</td><td>{r.work ? dur(r.work) : "–"}</td>
            <td><b>{c.showRep(r.rep)}</b></td><td>{r.hr ? Math.round(r.hr) : "–"}</td><td>{r.rpe ?? "–"}</td><td>{r.lac != null ? r.lac.toFixed(1) : "–"}</td><td>{r.onT != null ? r.onT + "/" + r.planned : "–"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
