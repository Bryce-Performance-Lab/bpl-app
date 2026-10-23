"use client";
import { useState } from "react";
import { addDays, iso, monday, totals, fromIso } from "@/lib/engine.js";
import { TAG_COLOUR } from "@/lib/data";
import { niceDate } from "@/components/SessionHead";
import { useAthlete, NotLinked } from "@/components/useAthlete";
import PlanTile from "@/components/PlanTile";

export default function AthleteCalendar() {
  const { athlete: a, plans, err } = useAthlete();
  const [sel, setSel] = useState(() => iso(new Date()));
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  if (err) return <p className="err">{err}</p>;
  if (a === undefined) return <p className="note">Loading…</p>;
  if (!a) return <NotLinked />;
  const today = iso(new Date()), first = monday(month), last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks = Math.ceil(((last.getTime() - first.getTime()) / 864e5 + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => iso(addDays(first, i)));
  const inMonth = (d: string) => fromIso(d).getMonth() === month.getMonth();
  const mp = plans.filter(p => inMonth(p.date)), run = mp.filter(p => p.tag !== "Rest");
  return (
    <>
      <div className="row">
        <h1 style={{ flex: 1 }}>{month.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h1>
        <span className="note"><b>{mp.reduce((s, p) => s + totals(a, p.steps).km, 0).toFixed(0)} km</b> planned · <b>{run.filter(p => p.analysis).length} of {run.length}</b> done</span>
        <button className="btn sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <button className="btn sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
        <button className="btn sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="mcal">
        <div className="mgrid" role="grid" aria-label="Month">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="h">{d}</div>)}
          {days.map(d => (
            <button key={d} type="button" aria-pressed={d === sel} aria-label={niceDate(d)} className={(!inMonth(d) ? "out " : "") + (d === today ? "today" : "")} onClick={() => setSel(d)}>
              {fromIso(d).getDate()}
              <span className="dots">{plans.filter(p => p.date === d).map(p => <i key={p.id} style={{ background: TAG_COLOUR[p.tag] || "var(--z2)", opacity: p.analysis || d >= today ? 1 : 0.4 }} />)}</span>
            </button>
          ))}
        </div>
        <div className="lab">{niceDate(sel)}</div>
        {plans.filter(p => p.date === sel).map(p => <PlanTile key={p.id} p={p} athlete={a} today={today} big />)}
        {!plans.some(p => p.date === sel) && <div style={{ border: "1.5px dashed var(--line)", borderRadius: 6, padding: 12, fontSize: 12, color: "var(--muted)" }}>Rest day</div>}
      </div>
      <div className="calwrap month">
        <div className="cal">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => <div key={d} className="h">{d}</div>)}
          {days.map(d => (
            <div key={d} className={"day" + (!inMonth(d) ? " out" : d === today ? " today" : d < today ? " past" : "")} style={{ minHeight: 100 }}>
              <div className="d"><span style={{ color: inMonth(d) ? undefined : "var(--muted)" }}>{fromIso(d).getDate()}</span></div>
              {inMonth(d) && plans.filter(p => p.date === d).map(p => <PlanTile key={p.id} p={p} athlete={a} today={today} />)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
