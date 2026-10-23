"use client";
import { useState } from "react";
import Link from "next/link";
import { fmt, mainStep, tagOf } from "@/lib/engine.js";
import { useAthlete, NotLinked } from "@/components/useAthlete";
import CompareView from "@/components/CompareView";
import DriftInsights from "@/components/DriftInsights";
import { niceDate } from "@/components/SessionHead";

export default function Progress() {
  const { athlete: a, plans, err } = useAthlete();
  const [open, setOpen] = useState<string | null>(null);
  if (err) return <p className="err">{err}</p>;
  if (a === undefined) return <p className="note">Loading…</p>;
  if (!a) return <NotLinked />;
  const quality = plans.filter(p => p.analysis && mainStep(p.steps)).sort((x, y) => y.date.localeCompare(x.date));
  const groups = Array.from(new Set(quality.map(p => tagOf(p.tag))));
  return (
    <>
      <div><h1>Progress</h1><div className="note">Each workout compared with your last 6 similar ones: same session type and setting, main set in the same zone.</div></div>
      {!quality.length && <div className="card note">Once you've logged a few workouts with reps, your progress shows here.</div>}
      {groups.map(g => (
        <section key={g} className="card stack">
          <h2>{g}</h2>
          {quality.filter(p => tagOf(p.tag) === g).map(p => (
            <div key={p.id} style={{ borderTop: "1px solid var(--sunk)", paddingTop: 8 }}>
              <div className="row">
                <div style={{ flex: 1 }}><b>{p.title}</b> <span className="note">{niceDate(p.date, false)}{p.setting ? " · " + p.setting : ""}</span>
                  <div className="note">{p.analysis.onTarget}/{p.analysis.plannedReps} on target · {fmt(p.analysis.pace)}/km avg</div></div>
                <Link className="btn sm" href={`/athlete/session/${p.id}`}>Open</Link>
                <button className={"btn sm" + (open === p.id ? " primary" : "")} onClick={() => setOpen(open === p.id ? null : p.id)}>Compare</button>
              </div>
              {open === p.id && <div style={{ marginTop: 10 }}><CompareView all={plans} ses={p} athlete={a} /></div>}
            </div>
          ))}
        </section>
      ))}
      <DriftInsights plans={plans} athlete={a} linkBase="/athlete/session/" />
    </>
  );
}
