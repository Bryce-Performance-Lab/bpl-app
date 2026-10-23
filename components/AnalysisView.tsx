"use client";
import { dur, fmt, hardest, paceChartSVG, partRole, totals, verdictFor, zone, zRangeShort, ZC, FIT_EPOCH } from "@/lib/engine.js";
import type { Athlete, Step } from "@/lib/data";

/** Detected workout, rep table, warm-up/cool-down, pace chart and time in zone. */
export default function AnalysisView({ an, athlete, steps, parts, onRemovePart }: { an: any; athlete: Athlete; steps: Step[]; parts?: any[]; onRemovePart?: (i: number) => void }) {
  if (!an) return null;
  const plannedT = totals(athlete, steps);
  const tot = (Object.values(an.zt) as number[]).reduce((p, c) => p + c, 0) || 1, ptot = (Object.values(plannedT.byZone) as number[]).reduce((p, c) => p + c, 0) || 1;
  const chart = paceChartSVG(an, athlete);
  const h0 = hardest(steps), hz = h0 ? zone(athlete, h0.zone) : null, steady = !an.plannedReps && hz && an.pace ? verdictFor(hz, an.pace) : null;
  const ps = (parts || []).slice().sort((a, b) => a.first - b.first);
  return (
    <div className="stack">
      {ps.length > 0 && (
        <div>
          <div className="lab" style={{ marginBottom: 4 }}>
            Files · {ps.length > 1 ? `${ps.length} files joined into one session` : an.breaks?.length ? `Recording stopped ${an.breaks.length} time${an.breaks.length > 1 ? "s" : ""}` : "One continuous file"}
          </div>
          <div className="rtab-wrap"><table className="rtab"><thead><tr><th>PART</th><th>FILE</th><th>START</th><th>TIME</th><th>DIST</th>{onRemovePart && <th />}</tr></thead><tbody>
            {ps.map((p, i) => {
              const km = p.session?.dist != null ? p.session.dist / 1000 : null, sec = p.session?.time != null ? p.session.time : p.last - p.first;
              return (
                <tr key={p.first}>
                  <td><span className="pill p-miss">{ps.length === 1 ? "Whole run" : partRole(an, p) || "Part " + (i + 1)}</span></td>
                  <td className="note">{p.name}</td>
                  <td>{new Date((p.first + FIT_EPOCH) * 1000).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}</td>
                  <td>{dur(sec)}</td><td>{km != null ? km.toFixed(2) + " km" : "–"}</td>
                  {onRemovePart && <td><button type="button" className="btn sm danger" onClick={() => onRemovePart(parts.indexOf(p))} aria-label={"Remove " + p.name}>✕</button></td>}
                </tr>
              );
            })}
          </tbody></table></div>
        </div>
      )}
      <div className="tiles">
        <div className="tile"><span>Distance</span><b>{an.km.toFixed(2)} km</b></div>
        <div className="tile"><span>Time</span><b>{dur(an.sec)}</b></div>
        <div className="tile"><span>Avg pace</span><b>{an.pace ? fmt(an.pace) + "/km" : "–"}</b></div>
        <div className="tile"><span>Avg HR</span><b>{an.hr ? an.hr + " bpm" : "–"}</b></div>
      </div>
      {an.plannedReps > 0 && (
        <div className="verdict">
          <b>Workout detected: {an.found}/{an.plannedReps} reps found</b>
          <span className={"pill " + (an.found < an.plannedReps ? "p-miss" : an.onTarget === an.plannedReps ? "p-ok" : "p-slow")}>{an.onTarget}/{an.plannedReps} on target</span>
        </div>
      )}
      {steady && (
        <div className="verdict"><b>Steady run in {h0.zone} ({zRangeShort(hz)}/km)</b><span className={"pill p-" + steady.k}>{steady.k === "ok" ? "Average pace on target" : "Average " + steady.t}</span></div>
      )}
      {an.sets.map((st: any) => {
        const ok = st.reps.filter((r: any) => !r.miss), key = st.byTime ? "sec" : "pace";
        const avg = ok.length ? Math.round(ok.reduce((p: number, c: any) => p + c[key], 0) / ok.length) : null;
        const spread = ok.length > 1 ? Math.max(...ok.map((r: any) => r[key])) - Math.min(...ok.map((r: any) => r[key])) : 0;
        return (
          <div key={st.step}>
            <div className="lab" style={{ marginBottom: 4 }}>{st.planned} · target {st.target} · from {st.source === "laps" ? "your laps" : "pace changes"}</div>
            {st.source !== "laps" && <p className="note" style={{ margin: "0 0 4px", color: "var(--bad)" }}>No rep laps found in this file, so rep times are estimated from pace changes and may be a few seconds out. Lap each rep on the watch for exact times.</p>}
            <div className="rtab-wrap"><table className="rtab">
              <thead><tr>{st.byTime ? <><th>REP</th><th>TIME</th><th>TARGET</th><th>HR</th><th>RESULT</th><th>GPS DIST</th></> : <><th>REP</th><th>PACE /KM</th><th>TIME</th><th>DIST</th><th>HR</th><th>RESULT</th></>}</tr></thead>
              <tbody>
                {st.reps.map((r: any, i: number) => r.miss ? (
                  <tr key={i}><td>{i + 1}</td><td colSpan={4} className="note">Not found in the file</td><td><span className="pill p-miss">Missing</span></td></tr>
                ) : st.byTime ? (
                  <tr key={i}><td>{i + 1}</td><td><b>{fmt(r.sec)}</b></td><td>{st.target.split(" per ")[0]}</td><td>{r.hr ?? "–"}</td><td><span className={"pill p-" + r.v}>{r.vt}</span></td><td className="note">{r.m} m</td></tr>
                ) : (
                  <tr key={i}><td>{i + 1}</td><td><b>{fmt(r.pace)}</b></td><td>{fmt(r.sec)}</td><td>{r.m} m</td><td>{r.hr ?? "–"}</td><td><span className={"pill p-" + r.v}>{r.vt}</span>{r.len && <span className="note"> {r.len}</span>}</td></tr>
                ))}
              </tbody>
            </table></div>
            {avg != null && <p className="note" style={{ margin: "4px 0 0" }}>{st.byTime ? `Average rep ${fmt(avg)} · spread ${spread} s between fastest and slowest. Judged on time, not GPS distance.` : `Average ${fmt(avg)}/km · spread ${spread} s/km between fastest and slowest rep.`}</p>}
          </div>
        );
      })}
      {an.segs?.length > 0 && (
        <div>
          <div className="lab" style={{ marginBottom: 4 }}>Warm-up and cool-down</div>
          <div className="rtab-wrap"><table className="rtab"><thead><tr><th>PART</th><th>PLANNED</th><th>TIME</th><th>DIST</th><th>PACE /KM</th><th>RESULT</th></tr></thead><tbody>
            {an.segs.map((g: any) => <tr key={g.name}><td><b>{g.name}</b></td><td className="note">{g.planned}</td><td>{g.sec ? dur(g.sec) : "–"}</td><td>{g.km ? g.km.toFixed(2) + " km" : "–"}</td><td>{g.pace ? fmt(g.pace) : "–"}</td><td><span className={"pill p-" + g.v}>{g.vt}</span></td></tr>)}
          </tbody></table></div>
        </div>
      )}
      {chart && <div><div className="lab" style={{ marginBottom: 4 }}>{an.firstS != null ? "Main session pace" : "Pace"}</div><div dangerouslySetInnerHTML={{ __html: chart }} /></div>}
      <div className="zcmp">
        <span className="note">Planned</span><div className="zbar">{ZC.map(z => plannedT.byZone[z] ? <i key={z} className={"z-" + z} style={{ width: (plannedT.byZone[z] / ptot * 100).toFixed(1) + "%" }} title={z} /> : null)}</div>
        <span className="note">Actual</span><div className="zbar">{ZC.map(z => an.zt[z] ? <i key={z} className={"z-" + z} style={{ width: (an.zt[z] / tot * 100).toFixed(1) + "%" }} title={z} /> : null)}</div>
        <span /><div className="row note">{ZC.filter(z => an.zt[z] >= 30).map(z => <span key={z}>{z} {dur(an.zt[z])}</span>)}</div>
      </div>
    </div>
  );
}
