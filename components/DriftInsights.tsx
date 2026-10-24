"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { analyse, driftPatterns, heatStress, hotRunsBefore, mergeParts } from "@/lib/engine.js";
import type { Athlete, Plan } from "@/lib/data";

const MIN_RUNS = 3;

/** Themes in the athlete's notes set against cardiac drift on their steady runs. */
function Rows({ rows, open, setOpen, pct, nice }: any) {
  return (
    <div className="rtab-wrap"><table className="rtab">
      <thead><tr><th>{rows[0]?.measured ? "CONDITION" : "THEME IN NOTES"}</th><th>RUNS</th><th>DRIFT WHEN PRESENT</th><th>DRIFT OTHERWISE</th><th>DIFFERENCE</th><th /></tr></thead>
      <tbody>{rows.map((r: any) => {
        const diff = r.without != null ? r.with - r.without : null;
        return (<Fragment key={r.key}>
          <tr>
            <td><b>{r.label}</b></td><td>{r.n}</td><td>{pct(r.with)}</td><td>{pct(r.without)}</td>
            <td>{diff == null ? "–" : <span className={"pill " + (diff >= 2 ? "p-slow" : diff >= 0.5 ? "p-fast" : diff <= -0.5 ? "p-ok" : "p-miss")}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)} pts</span>}{r.n < 3 && <span className="note"> few runs</span>}</td>
            <td><button type="button" className="btn sm" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>{open === r.key ? "Hide" : "Runs"}</button></td>
          </tr>
          {open === r.key && <tr><td colSpan={6} style={{ background: "var(--sunk)" }}>
            {r.runs.map((x: any) => <div key={x.id} style={{ padding: "3px 0" }}><b>{nice(x.date)}</b> {x.title} · drift {pct(x.drift)}{x.w ? ` · ${x.w.temp}°C, dew ${x.w.dew}°C, wind ${x.w.wind} km/h` : ""}{x.note ? <span className="note"> · “{x.note}”</span> : null}</div>)}
          </td></tr>}
        </Fragment>);
      })}</tbody>
    </table></div>
  );
}

export default function DriftInsights({ plans, athlete, linkBase }: { plans: Plan[]; athlete: Athlete; linkBase?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const data = useMemo(() => {
    const runs = plans.filter(p => p.activity?.parts?.length).map(p => {
      let drift = null;
      try { drift = analyse(mergeParts(p.activity.parts), athlete, p.steps).drift; } catch { /* unreadable run */ }
      const w = p.activity.weather || null;
      return { id: p.id, date: p.date, title: p.title, drift, note: p.activity.comment || "", w, hs: heatStress(w, hotRunsBefore(plans, p.date)) };
    });
    const out: any = driftPatterns(runs);
    // measured conditions (Open-Meteo), independent of what was written
    const withW = out.runs.filter((r: any) => r.w);
    const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : null;
    out.measured = [
      { key: "m-dew", label: "Dew point 16°C or more", test: (w: any) => w.dew >= 16 },
      { key: "m-temp", label: "Temperature 24°C or more", test: (w: any) => w.temp >= 24 },
      { key: "m-wind", label: "Wind 20 km/h or more", test: (w: any) => w.wind >= 20 },
      { key: "m-spike", label: "Heat spike (5°C+ above past 2 weeks)", test: (_: any, r: any) => r.hs?.anomaly >= 5 },
      { key: "m-noacc", label: "Hot day, not heat acclimatised", test: (_: any, r: any) => r.hs?.acc?.level === 0 },
      { key: "m-high", label: "High heat stress (adjusted for acclimatisation)", test: (_: any, r: any) => (r.hs?.level ?? 0) >= 2 },
    ].map(m => { const yes = withW.filter((r: any) => m.test(r.w, r)), no = withW.filter((r: any) => !m.test(r.w, r));
      return { key: m.key, label: m.label, n: yes.length, with: avg(yes.map((r: any) => r.drift)), without: avg(no.map((r: any) => r.drift)), runs: yes, measured: true }; })
      .filter((m: any) => m.n > 0 && m.n < withW.length);
    out.nWeather = withW.length;
    return out;
  }, [plans, athlete]);

  const n = data.runs.length;
  const nice = (d: string) => new Date(d + "T00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const pct = (v: number | null) => v == null ? "–" : (v > 0 ? "+" : "") + v.toFixed(1) + "%";
  return (
    <section className="card stack">
      <div>
        <h2>Drift patterns</h2>
        <p className="note" style={{ margin: "2px 0 0" }}>Cardiac drift on steady runs of 20 min or more, set against what the athlete wrote in their notes (heat, sleep, illness, fuel, stress and so on).</p>
      </div>
      {n < MIN_RUNS ? (
        <p className="note" style={{ margin: 0 }}>{n ? `${n} steady run${n > 1 ? "s" : ""} so far.` : "No steady runs with heart rate yet."} Patterns appear after {MIN_RUNS} or more easy, long or recovery runs with heart rate and a note.</p>
      ) : (
        <>
          <div className="tiles">
            <div className="tile"><span>Steady runs</span><b>{n}</b></div>
            <div className="tile"><span>Average drift</span><b>{pct(data.overall)}</b></div>
            <div className="tile"><span>Over 5%</span><b>{data.runs.filter((r: any) => r.drift >= 5).length}</b></div>
            <div className="tile"><span>Not explained by notes</span><b>{data.unexplained.length}</b></div>
          </div>
          {data.measured?.length > 0 && <div className="lab">Measured conditions (Open-Meteo, {data.nWeather} runs with weather)</div>}
          {data.measured?.length > 0 && <Rows rows={data.measured} open={open} setOpen={setOpen} pct={pct} nice={nice} />}
          {data.rows.length > 0 && <div className="lab">From the athlete's notes</div>}
          {data.rows.length ? (
            <Rows rows={data.rows} open={open} setOpen={setOpen} pct={pct} nice={nice} />
          ) : <p className="note" style={{ margin: 0 }}>None of the notes on these runs mention a known drift factor yet.</p>}
          {data.unexplained.length > 0 && (
            <div>
              <div className="lab" style={{ marginBottom: 4 }}>High drift (5%+) the notes don't explain</div>
              {data.unexplained.map((x: any) => (
                <div key={x.id} style={{ padding: "3px 0", fontSize: 13 }}>
                  {linkBase ? <Link href={linkBase + x.id}><b>{nice(x.date)}</b> {x.title}</Link> : <><b>{nice(x.date)}</b> {x.title}</>} · drift {pct(x.drift)} · <span className="note">{x.note ? `“${x.note}”` : "no note"}</span>
                </div>
              ))}
              <p className="note" style={{ margin: "4px 0 0" }}>Worth asking about sleep, fuelling, hydration and the conditions on these days.</p>
            </div>
          )}
          <p className="note" style={{ margin: 0 }}>A pattern, not proof: it only shows what was mentioned alongside higher drift. Differences from one or two runs can be chance.</p>
        </>
      )}
    </section>
  );
}
