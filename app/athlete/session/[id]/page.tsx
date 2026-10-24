"use client";
import { use, useState } from "react";
import Link from "next/link";
import { hotRunsBefore, iso } from "@/lib/engine.js";
import { useAthlete, NotLinked } from "@/components/useAthlete";
import SessionHead from "@/components/SessionHead";
import StepsList from "@/components/StepsList";
import RunLogger from "@/components/RunLogger";
import RunSummary from "@/components/RunSummary";
import AnalysisView from "@/components/AnalysisView";
import CompareView from "@/components/CompareView";
import { useToast } from "@/components/Toast";
import { backfillWeather } from "@/lib/backfill";

export default function AthleteSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { athlete: a, plans, err, reload } = useAthlete();
  const [editing, setEditing] = useState(false), [cmp, setCmp] = useState(false);
  const toast = useToast();
  if (err) return <p className="err">{err}</p>;
  if (a === undefined) return <p className="note">Loading…</p>;
  if (!a) return <NotLinked />;
  const p = plans.find(x => x.id === id);
  if (!p) return <p className="note">Session not found. <Link href="/athlete">Back to this week</Link></p>;
  const today = iso(new Date()), act = p.activity;
  if (act && !act.weather) backfillWeather(act, plans).then(x => { if (x) reload(); });
  return (
    <>
      <div className="note"><Link href="/athlete">← This week</Link></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <section className="card stack" style={{ flex: "999 1 480px", minWidth: 0 }}>
          <SessionHead s={p} athlete={a} />
          <StepsList steps={p.steps} athlete={a} />
          {p.notes && <div className="card" style={{ padding: 10, borderLeft: "4px solid var(--sky)" }}><div className="lab">From your coach</div>{p.notes}</div>}
        </section>
        <section className="card stack" style={{ flex: "1 1 380px", minWidth: 0 }}>
          {act && !editing ? (
            <>
              <div className="row"><h2 style={{ flex: 1 }}>Your run</h2><button className="btn sm" onClick={() => setEditing(true)}>Edit or add files</button></div>
              <RunSummary act={act} />
            </>
          ) : p.tag === "Rest" ? <p className="note">Rest day: nothing to log.</p> : (
            <>
              <h2>{act ? "Update this run" : p.date > today ? "Log this run (after you've done it)" : "Log this run"}</h2>
              <RunLogger athlete={a} plan={p} onCancel={act ? () => setEditing(false) : undefined}
                onSaved={async x => { toast.show(x ? "Run saved" : "Run removed"); setEditing(false); await reload(); }} />
            </>
          )}
        </section>
      </div>
      {act?.analysis && !editing && (
        <section className="card stack">
          <div className="row"><h2 style={{ flex: 1 }}>Result</h2><button className={"btn sm" + (cmp ? " primary" : "")} onClick={() => setCmp(!cmp)}>Compare with past sessions</button></div>
          {cmp && <CompareView all={plans} ses={p} athlete={a} />}
          <AnalysisView an={act.analysis} athlete={a} steps={p.steps} parts={act.parts} note={act.comment} weather={act.weather} hotRuns={hotRunsBefore(plans, p.date)} />
        </section>
      )}
      {toast.node}
    </>
  );
}
