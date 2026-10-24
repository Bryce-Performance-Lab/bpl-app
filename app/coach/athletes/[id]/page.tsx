"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { loadPlans, TAG_COLOUR, type Athlete, type Plan } from "@/lib/data";
import { addDays, dur, fmt, headline, hotRunsBefore, mainStep, iso, monday, totals, zRange, ZC, ZNAME, fromIso } from "@/lib/engine.js";
import Dialog from "@/components/Dialog";
import AthleteForm from "@/components/AthleteForm";
import SessionEditor from "@/components/SessionEditor";
import AnalysisView from "@/components/AnalysisView";
import CompareView from "@/components/CompareView";
import RunLogger from "@/components/RunLogger";
import RunSummary from "@/components/RunSummary";
import { niceDate } from "@/components/SessionHead";
import { useToast } from "@/components/Toast";
import DriftInsights from "@/components/DriftInsights";
import { backfillRecent, backfillWeather } from "@/lib/backfill";
import { weatherChip } from "@/lib/weather";

const WEEKS = 4, DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function CoachAthlete({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<Athlete | null>(null), [plans, setPlans] = useState<Plan[]>([]), [err, setErr] = useState("");
  const [start, setStart] = useState(() => addDays(monday(new Date()), -7));
  const [editZones, setEditZones] = useState(false);
  const [open, setOpen] = useState<{ plan?: Plan; date: string; tab: "plan" | "run" } | null>(null);
  const [cmp, setCmp] = useState(false), [upload, setUpload] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("athletes").select("*").eq("id", id).single();
    if (error) { setErr("Athlete not found."); return; }
    setA(data as Athlete);
    try {
      const ps = await loadPlans(id); setPlans(ps);
      backfillRecent(ps, (pid, act) => setPlans(cur => cur.map(p => p.id === pid ? { ...p, activity: act } : p)));
    } catch (e: any) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => Array.from({ length: WEEKS * 7 }, (_, i) => iso(addDays(start, i))), [start]);
  const today = iso(new Date());
  if (err) return <p className="err">{err} <Link href="/coach">Back to athletes</Link></p>;
  if (!a) return <p className="note">Loading…</p>;

  const cur = open?.plan ? plans.find(p => p.id === open.plan!.id) || open.plan : null;
  if (cur?.activity && !cur.activity.weather) backfillWeather(cur.activity, plans).then(x => { if (x) setPlans(ps => ps.map(p => p.id === cur.id ? { ...p, activity: x } : p)); });
  function close() { setOpen(null); setCmp(false); setUpload(false); }
  function show(p: Plan) { setOpen({ plan: p, date: p.date, tab: p.activity ? "run" : "plan" }); setCmp(false); setUpload(false); }

  return (
    <>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div className="note"><Link href="/coach">Athletes</Link> /</div>
          <h1>{a.name}</h1>
          <div className="note">{a.event || ""} {a.user_id ? <span className="pill p-ok">Linked</span> : <span className="pill p-miss">Invited · not signed up yet</span>}</div>
        </div>
        <button className="btn" onClick={() => setEditZones(true)}>Edit details and zones</button>
        <button className="btn primary" onClick={() => setOpen({ date: today, tab: "plan" })}>+ New session</button>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {a.zones?.length ? (
          <div className="row" style={{ gap: 14 }}>
            {a.zones.map(z => <span key={z.code} className="row" style={{ gap: 6 }}><span className={"zchip z-" + z.code}>{z.code}</span><span style={{ fontSize: 12 }}>{zRange(z)}/km{z.hr ? ` · ${z.hr} bpm` : ""}</span></span>)}
            <span className="note">LT1 {fmt(a.lt1)} · LT2 {fmt(a.lt2)}{a.test_date ? ` · tested ${niceDate(a.test_date, false)}` : ""}</span>
          </div>
        ) : <span className="note">No zones yet. <button className="btn sm" onClick={() => setEditZones(true)}>Add test paces</button> so sessions show target paces and runs can be analysed.</span>}
      </div>

      <div className="row">
        <button className="btn sm" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>←</button>
        <button className="btn sm" onClick={() => setStart(addDays(monday(new Date()), -7))}>This week</button>
        <button className="btn sm" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}>→</button>
        <b>{fromIso(days[0]).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – {fromIso(days[days.length - 1]).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</b>
      </div>

      <div className="calwrap">
        <div className="cal" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr)) 120px" }}>
          {DOW.map(d => <div key={d} className="h">{d}</div>)}<div className="h">WEEK</div>
          {Array.from({ length: WEEKS }, (_, w) => {
            const wk = days.slice(w * 7, w * 7 + 7), wp = plans.filter(p => wk.includes(p.date));
            const planned = wp.reduce((s, p) => s + totals(a, p.steps).km, 0), done = wp.filter(p => p.activity);
            return [
              ...wk.map(d => (
                <div key={d} className={"day" + (d === today ? " today" : d < today ? " past" : "")}>
                  <div className="d"><span>{fromIso(d).getDate()}{fromIso(d).getDate() === 1 || d === days[0] ? " " + fromIso(d).toLocaleDateString("en-AU", { month: "short" }) : ""}</span>
                    <button className="add" aria-label={"Add session on " + niceDate(d)} onClick={() => setOpen({ date: d, tab: "plan" })}>+</button></div>
                  {plans.filter(p => p.date === d).map(p => (
                    <button key={p.id} className="scard" style={{ borderLeftColor: TAG_COLOUR[p.tag] || "var(--z2)" }} onClick={() => show(p)}>
                      <b>{p.title}</b><span>{headline(p.steps)}</span>
                      {p.analysis ? (p.analysis.plannedReps
                        ? <span className={"pill " + (p.analysis.found < p.analysis.plannedReps ? "p-miss" : p.analysis.onTarget === p.analysis.plannedReps ? "p-ok" : "p-slow")}>{p.analysis.onTarget}/{p.analysis.plannedReps} on target</span>
                        : <span className="pill p-ok">✓ {p.analysis.km.toFixed(1)} km · {fmt(p.analysis.pace)}/km</span>)
                        : d < today && p.tag !== "Rest" ? <span className="note">Not logged</span> : null}
                      {p.activity?.weather && <span className="note">{weatherChip(p.activity.weather)}</span>}
                    </button>
                  ))}
                </div>
              )),
              <div key={"w" + w} className="day" style={{ background: "var(--sunk)", minHeight: 0 }}>
                <span className="lab">Week</span><b>{planned.toFixed(1)} km</b>
                <span className="note">{done.length} of {wp.filter(p => p.tag !== "Rest").length} done</span>
                <span className="note">{done.reduce((s, p) => s + (p.analysis?.km || 0), 0).toFixed(1)} km run</span>
              </div>,
            ];
          })}
        </div>
      </div>
      <div className="row note">{ZC.map(z => <span key={z} className="row" style={{ gap: 4 }}><span className={"zchip z-" + z}>{z}</span>{ZNAME[z]}</span>)}</div>
      <DriftInsights plans={plans} athlete={a} />

      <Dialog open={editZones} onClose={() => setEditZones(false)} title={"Details and zones · " + a.name}>
        <AthleteForm athlete={a} onCancel={() => setEditZones(false)} onSaved={x => { setA(x); setEditZones(false); toast.show("Saved"); }} />
      </Dialog>

      <Dialog open={!!open} onClose={close} title={cur ? cur.title : "New session"} sub={open ? niceDate(cur?.date || open.date) + " · " + a.name : ""}>
        {open && (
          <>
            {cur && (
              <div className="row" role="tablist">
                <button role="tab" aria-selected={open.tab === "plan"} className={"btn sm" + (open.tab === "plan" ? " primary" : "")} onClick={() => setOpen({ ...open, tab: "plan" })}>Plan</button>
                <button role="tab" aria-selected={open.tab === "run"} className={"btn sm" + (open.tab === "run" ? " primary" : "")} onClick={() => setOpen({ ...open, tab: "run" })}>Run data{cur.activity ? " ✓" : ""}</button>
              </div>
            )}
            {open.tab === "plan" && (
              <SessionEditor key={cur?.id || open.date} athlete={a} session={cur} date={open.date} onDone={async msg => { if (msg) { toast.show(msg); await load(); } close(); }} />
            )}
            {open.tab === "run" && cur && (
              cur.activity && !upload ? (
                <div className="stack">
                  <div className="row">
                    <span className="note">Logged {cur.activity.analysis ? `· ${cur.activity.analysis.km.toFixed(2)} km · ${dur(cur.activity.analysis.sec)}` : ""}</span><span className="sp" />
                    <button className="btn sm" onClick={() => setUpload(true)}>Add or replace files</button>
                    {cur.analysis && <button className={"btn sm" + (cmp ? " primary" : "")} onClick={() => setCmp(!cmp)}>Compare ↗</button>}
                  </div>
                  {cmp && <div className="card"><h3 style={{ marginBottom: 8 }}>Compare with similar sessions</h3><CompareView all={plans} ses={cur} athlete={a} /></div>}
                  <RunSummary act={cur.activity} coach onSaved={() => load()} session={!!mainStep(cur.steps)} />
                  <AnalysisView an={cur.analysis} athlete={a} steps={cur.steps} parts={cur.activity.parts} note={cur.activity.comment} weather={cur.activity.weather} hotRuns={hotRunsBefore(plans, cur.date)} />
                </div>
              ) : (
                <RunLogger athlete={a} plan={cur} onCancel={cur.activity ? () => setUpload(false) : undefined}
                  onSaved={async () => { toast.show("Run saved"); setUpload(false); await load(); }} />
              )
            )}
          </>
        )}
      </Dialog>
      {toast.node}
    </>
  );
}
