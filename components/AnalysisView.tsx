"use client";
import { useEffect, useMemo, useState } from "react";
import { analyse, detectThemes, dewBand, heatStress, isHot, seasonOf, thermalStrain, dur, fmt, hardest, hrChartSVG, hrZone, hrRangeText, mergeParts, paceChartSVG, partRole, totals, verdictFor, zone, zRangeShort, ZC, FIT_EPOCH } from "@/lib/engine.js";
import type { Athlete, Step } from "@/lib/data";
import { fetchHeatContext, windWord } from "@/lib/weather";

/** Detected workout, rep table, warm-up/cool-down, pace chart and time in zone. */
export default function AnalysisView({ an: saved, athlete, steps, parts, onRemovePart, note, weather: savedWeather, hotRuns }: { an: any; athlete: Athlete; steps: Step[]; parts?: any[]; onRemovePart?: (i: number) => void; note?: string | null; weather?: any; hotRuns?: number }) {
  // runs saved before acclimatisation was added: look up the past fortnight on the fly
  const [ctx, setCtx] = useState<any>(null);
  useEffect(() => { let live = true; setCtx(null); if (savedWeather && !savedWeather.context && isHot(savedWeather)) fetchHeatContext(savedWeather, new Date(savedWeather.start)).then(c => { if (live) setCtx(c); }); return () => { live = false; }; }, [savedWeather]);
  const weather = savedWeather ? { ...savedWeather, context: savedWeather.context || ctx } : null;
  const hs = heatStress(weather, hotRuns);
  // Re-run the analysis from the stored files so it always uses the athlete's current zones (pace and HR).
  const an = useMemo(() => { try { return parts?.length ? analyse(mergeParts(parts), athlete, steps) : saved; } catch { return saved; } }, [saved, parts, athlete, steps]);
  if (!an) return null;
  const hrChart = hrChartSVG(an, athlete), htot = (Object.values(an.hzt || {}) as number[]).reduce((p, c) => p + c, 0) || 1;
  const hrPill = (k: string, t: string) => k && k !== "miss" ? <span className={"pill p-" + k} style={{ marginLeft: 6 }}>{t}</span> : null;
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
        {an.hrMax ? <div className="tile"><span>Max HR</span><b>{an.hrMax} bpm</b></div> : null}
      </div>
      {weather && (
        <div className="card" style={{ padding: 12, background: "var(--sunk)", border: 0 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="lab">Weather during the run{seasonOf(weather.lat, weather.start) ? " · " + seasonOf(weather.lat, weather.start) : ""}</span><span className="sp" />
            {dewBand(weather.dew) && <span className={"pill p-" + dewBand(weather.dew).k}>{dewBand(weather.dew).t}</span>}
          </div>
          <div className="row" style={{ gap: 16, fontSize: 13 }}>
            <span><b>{weather.temp}°C</b> <span className="note">feels {weather.feels}°C</span></span>
            <span><b>{weather.rh}%</b> <span className="note">humidity</span></span>
            <span><b>{weather.dew}°C</b> <span className="note">dew point</span></span>
            <span><b>{weather.wind} km/h</b> <span className="note">{windWord(weather.windDir)} wind{weather.gust ? `, gusts ${Math.round(weather.gust)}` : ""}</span></span>
            {weather.rain ? <span><b>{weather.rain} mm</b> <span className="note">rain</span></span> : null}
          </div>
          {hs && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <div className="row"><b style={{ fontSize: 13 }}>Heat stress for this athlete</b><span className={"pill p-" + hs.k}>{hs.t}</span>{hs.acc && <span className={"pill p-" + hs.acc.k}>{hs.acc.t}</span>}</div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>{hs.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
              <div className="note" style={{ marginTop: 4 }}>Heat acclimatisation builds over about 1–2 weeks of regular heat and fades after a few weeks without it, so early-season hot days hit harder. This is an estimate from local weather and logged runs.</div>
            </div>
          )}
          <div className="note" style={{ marginTop: 6 }}>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> for the run's start area and time.</div>
        </div>
      )}
      {!weather && parts?.length > 0 && !parts.some((p: any) => p.pos) && <p className="note" style={{ margin: 0 }}>No weather for this run: the file has no GPS position (treadmill, GPS off, or uploaded before weather was added).</p>}
      {an.hr && an.hasHrZones === false && <p className="note" style={{ margin: 0 }}>Heart rate isn't judged yet: add HR ranges to this athlete's zones (e.g. 140–158) to see whether HR was in zone.</p>}
      {an.plannedReps > 0 && (
        <div className="verdict">
          <b>Workout detected: {an.found}/{an.plannedReps} reps found</b>
          <span className={"pill " + (an.found < an.plannedReps ? "p-miss" : an.onTarget === an.plannedReps ? "p-ok" : "p-slow")}>{an.onTarget}/{an.plannedReps} on target</span>
        </div>
      )}
      {steady && (
        <div className="verdict"><b>Steady run in {h0.zone} ({zRangeShort(hz)}/km)</b><span className={"pill p-" + steady.k}>{steady.k === "ok" ? "Average pace on target" : "Average " + steady.t}</span></div>
      )}
      {an.steadyHr && an.steadyHr.k !== "miss" && (
        <div className="verdict">
          <b>Heart rate: {an.hr} bpm average{an.steadyHr.range ? ` · ${an.steadyHr.zone} is ${an.steadyHr.range} bpm` : ""}{an.steadyHr.actualZone && an.steadyHr.actualZone !== an.steadyHr.zone ? ` · ran in ${an.steadyHr.actualZone}` : ""}</b>
          <span className={"pill p-" + an.steadyHr.k}>{an.steadyHr.k === "ok" ? "Average HR in zone" : "Average HR " + an.steadyHr.t}</span>
        </div>
      )}
      {an.drift != null && (
        <div className="verdict">
          <b>Cardiac drift: {an.drift > 0 ? "+" : ""}{an.drift}%</b>
          <span className="note" style={{ flex: "1 1 260px" }}>How much less pace you got per heartbeat in the second half than the first (warm-up left out). Under 5% means good aerobic control; higher often means heat, dehydration, fatigue or going out too fast.</span>
          <span className={"pill " + (an.drift < 5 ? "p-ok" : an.drift < 8 ? "p-fast" : "p-slow")}>{an.drift < 5 ? "Steady" : an.drift < 8 ? "Some drift" : "High drift"}</span>
          {(() => {
            const th = detectThemes(note);
            if (th.length) return <div className="row" style={{ flexBasis: "100%", gap: 6 }}><span className="note">From the note:</span>{th.map((t: any) => <span key={t.key} className="pill p-miss" title={"Mentioned: " + t.words.join(", ")}>{t.label}</span>)}</div>;
            if (an.drift >= 5) return <div className="note" style={{ flexBasis: "100%" }}>{note ? "Nothing in the note points to a cause." : "No note on this run."} Worth checking sleep, fuelling, hydration and the conditions.</div>;
            return null;
          })()}
        </div>
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
                  <tr key={i}><td>{i + 1}</td><td><b>{fmt(r.sec)}</b></td><td>{st.target.split(" per ")[0]}</td><td>{r.hr ?? "–"}{hrPill(r.hv, r.hvt)}</td><td><span className={"pill p-" + r.v}>{r.vt}</span></td><td className="note">{r.m} m</td></tr>
                ) : (
                  <tr key={i}><td>{i + 1}</td><td><b>{fmt(r.pace)}</b></td><td>{fmt(r.sec)}</td><td>{r.m} m</td><td>{r.hr ?? "–"}{hrPill(r.hv, r.hvt)}</td><td><span className={"pill p-" + r.v}>{r.vt}</span>{r.len && <span className="note"> {r.len}</span>}</td></tr>
                ))}
              </tbody>
            </table></div>
            {hrZone(athlete, st.zone) && <p className="note" style={{ margin: "4px 0 0" }}>HR target for {st.zone}: {hrRangeText(hrZone(athlete, st.zone))} bpm, judged on the second half of each rep (HR takes time to rise). Reps under 2 min aren't judged on HR.</p>}
            {avg != null && <p className="note" style={{ margin: "4px 0 0" }}>{st.byTime ? `Average rep ${fmt(avg)} · spread ${spread} s between fastest and slowest. Judged on time, not GPS distance.` : `Average ${fmt(avg)}/km · spread ${spread} s/km between fastest and slowest rep.`}</p>}
          </div>
        );
      })}
      {an.segs?.length > 0 && (
        <div>
          <div className="lab" style={{ marginBottom: 4 }}>Warm-up and cool-down</div>
          <div className="rtab-wrap"><table className="rtab"><thead><tr><th>PART</th><th>PLANNED</th><th>TIME</th><th>DIST</th><th>PACE /KM</th><th>RESULT</th><th>AVG HR</th></tr></thead><tbody>
            {an.segs.map((g: any) => <tr key={g.name}><td><b>{g.name}</b></td><td className="note">{g.planned}</td><td>{g.sec ? dur(g.sec) : "–"}</td><td>{g.km ? g.km.toFixed(2) + " km" : "–"}</td><td>{g.pace ? fmt(g.pace) : "–"}</td><td><span className={"pill p-" + g.v}>{g.vt}</span></td><td>{g.hr ?? "–"}{hrPill(g.hv, g.hvt)}</td></tr>)}
          </tbody></table></div>
        </div>
      )}
      {chart && <div><div className="lab" style={{ marginBottom: 4 }}>{an.firstS != null ? "Main session pace" : "Pace"}</div><div dangerouslySetInnerHTML={{ __html: chart }} /></div>}
      {hrChart && <div><div className="lab" style={{ marginBottom: 4 }}>{an.firstS != null ? "Main session heart rate" : "Heart rate"}</div><div dangerouslySetInnerHTML={{ __html: hrChart }} /></div>}
      {isHot(weather) && (() => {
        const ts = thermalStrain(an, weather);
        if (!ts) return <div className="verdict"><b>Hot or humid conditions</b><span className="note" style={{ flex: "1 1 260px" }}>This watch didn't record temperature on this run, so skin temperature can't be checked.</span></div>;
        return (
          <div className="verdict">
            <b>Watch temperature: {ts.base}°C → {ts.end}°C ({ts.rise > 0 ? "+" : ""}{ts.rise}°C), peak {ts.max}°C</b>
            <span className={"pill p-" + ts.k}>{ts.t}</span>
            <div className="note" style={{ flexBasis: "100%" }}>
              {ts.both ? `Signs of thermal strain: skin temperature climbed while heart rate drifted ${an.drift}% in ${weather.temp}°C, dew point ${weather.dew}°C. ` : ts.k === "ok" ? "Skin temperature held steady despite the conditions. " : "Skin temperature climbed through the run. "}
              The watch sensor sits on the wrist, so it tracks skin temperature (and is nudged by sun and sleeves), not core temperature. Read it as a trend.
            </div>
          </div>
        );
      })()}
      <div className="zcmp">
        <span className="note">Planned</span><div className="zbar">{ZC.map(z => plannedT.byZone[z] ? <i key={z} className={"z-" + z} style={{ width: (plannedT.byZone[z] / ptot * 100).toFixed(1) + "%" }} title={z} /> : null)}</div>
        <span className="note">Pace</span><div className="zbar">{ZC.map(z => an.zt[z] ? <i key={z} className={"z-" + z} style={{ width: (an.zt[z] / tot * 100).toFixed(1) + "%" }} title={z} /> : null)}</div>
        <span /><div className="row note">{ZC.filter(z => an.zt[z] >= 30).map(z => <span key={z}>{z} {dur(an.zt[z])}</span>)}</div>
        {an.hzt && Object.keys(an.hzt).length > 0 && <>
          <span className="note">HR</span><div className="zbar">{ZC.map(z => an.hzt[z] ? <i key={z} className={"z-" + z} style={{ width: (an.hzt[z] / htot * 100).toFixed(1) + "%" }} title={z} /> : null)}</div>
          <span /><div className="row note">{ZC.filter(z => an.hzt[z] >= 30).map(z => <span key={z}>{z} {dur(an.hzt[z])}</span>)}</div>
        </>}
      </div>
    </div>
  );
}
