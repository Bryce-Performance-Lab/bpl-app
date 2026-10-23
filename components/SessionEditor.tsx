"use client";
import { useState } from "react";
import { dur, SETTINGS, TAGS, TEMPLATES, totals, ZC, iso, addDays, fromIso } from "@/lib/engine.js";
import { supabase } from "@/lib/supabase/client";
import type { Athlete, Session, Step } from "@/lib/data";

const UNITS = [["min", "min"], ["sec", "sec"], ["km", "km"], ["m", "m"]];

/** Plan or edit one session: template, tag, setting, steps with reps and recoveries. */
export default function SessionEditor({ athlete, session, date, onDone }: { athlete: Athlete; session?: Session | null; date: string; onDone: (msg?: string) => void }) {
  const [d, setD] = useState<Omit<Session, "id" | "athlete_id">>(() => session
    ? { date: session.date, title: session.title, tag: session.tag, setting: session.setting, steps: session.steps.map(s => ({ ...s })), notes: session.notes }
    : { date, title: "", tag: "Easy", setting: "Road", steps: [{ label: "", reps: 1, amount: 45, unit: "min", zone: "T2" }], notes: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setD({ ...d, [k]: v });
  const setStep = (i: number, k: keyof Step, v: any) => set("steps", d.steps.map((s, j) => j === i ? { ...s, [k]: v } : s));
  const t = totals(athlete, d.steps);

  function applyTemplate(name: string) {
    const tp = TEMPLATES.find(x => x.title === name); if (!tp) return;
    setD({ ...d, title: tp.title === "Rest day" ? "Rest" : tp.title, tag: tp.tag, setting: tp.setting || d.setting, steps: tp.steps.map(s => ({ ...s })) as Step[] });
  }
  async function save(copyNextWeek = false) {
    setErr("");
    if (d.steps.some(s => !(+s.amount > 0))) { setErr("Each step needs an amount."); return; }
    setBusy(true);
    const sb = supabase();
    const row = { ...d, athlete_id: athlete.id, title: d.title.trim() || d.tag, notes: d.notes?.trim() || null, steps: d.steps.map(s => ({ ...s, reps: +s.reps || 1, amount: +s.amount, recAmount: s.recAmount ? +s.recAmount : undefined })) };
    let error;
    if (copyNextWeek) ({ error } = await sb.from("sessions").insert({ ...row, date: iso(addDays(fromIso(d.date), 7)) }));
    else if (session) ({ error } = await sb.from("sessions").update(row).eq("id", session.id));
    else ({ error } = await sb.from("sessions").insert(row));
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone(copyNextWeek ? "Copied to next week" : "Session saved");
  }
  async function remove() {
    if (!session) return; setBusy(true);
    const { error } = await supabase().from("sessions").delete().eq("id", session.id); setBusy(false);
    if (error) setErr(error.message); else onDone("Session deleted");
  }

  return (
    <div className="stack">
      <div className="grid2">
        <label className="f">START FROM A TEMPLATE<select value="" onChange={e => applyTemplate(e.target.value)}><option value="">Choose…</option>{TEMPLATES.map(x => <option key={x.title}>{x.title}</option>)}</select></label>
        <label className="f">TITLE<input value={d.title} placeholder="e.g. Track 400s" onChange={e => set("title", e.target.value)} /></label>
        <label className="f">DATE<input type="date" required value={d.date} onChange={e => set("date", e.target.value)} /></label>
        <label className="f">SESSION TAG<select value={d.tag} onChange={e => set("tag", e.target.value)}>{TAGS.map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="f">SETTING<select value={d.setting || ""} onChange={e => set("setting", e.target.value || null)}><option value="">–</option>{SETTINGS.map(x => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row"><span className="lab">Steps</span><span className="sp" /><span className="note">Planned ≈ <b>{t.km.toFixed(1)} km</b> · <b>{dur(t.sec)}</b></span></div>
        {d.steps.map((s, i) => (
          <div className="step" key={i}>
            <label className="f">LABEL<input value={s.label || ""} placeholder="Warm-up / Reps" onChange={e => setStep(i, "label", e.target.value)} /></label>
            <label className="f">REPS<input type="number" min="1" value={s.reps} onChange={e => setStep(i, "reps", e.target.value)} /></label>
            <label className="f">AMOUNT<input type="number" min="0" step="any" value={s.amount} onChange={e => setStep(i, "amount", e.target.value)} /></label>
            <label className="f">UNIT<select value={s.unit} onChange={e => setStep(i, "unit", e.target.value)}>{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="f">ZONE<select value={s.zone} onChange={e => setStep(i, "zone", e.target.value)}>{ZC.map(z => <option key={z}>{z}</option>)}</select></label>
            <button type="button" className="btn sm danger" aria-label={"Remove step " + (i + 1)} onClick={() => set("steps", d.steps.filter((_, j) => j !== i))}>✕</button>
            {+s.reps > 1 && (
              <div className="rec">
                <span className="note" style={{ paddingBottom: 10 }}>Recovery</span>
                <label className="f">AMOUNT<input type="number" min="0" step="any" value={s.recAmount ?? ""} onChange={e => setStep(i, "recAmount", e.target.value)} /></label>
                <label className="f">UNIT<select value={s.recUnit || "sec"} onChange={e => setStep(i, "recUnit", e.target.value)}>{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="f">ZONE<select value={s.recZone || "T1"} onChange={e => setStep(i, "recZone", e.target.value)}>{ZC.map(z => <option key={z}>{z}</option>)}</select></label>
              </div>
            )}
          </div>
        ))}
        <div><button type="button" className="btn sm" onClick={() => set("steps", [...d.steps, { label: "", reps: 1, amount: 10, unit: "min", zone: "T2", recUnit: "sec", recZone: "T1" }])}>+ Add step</button></div>
        <p className="note" style={{ margin: 0 }}>Tip: plan distance reps (e.g. 8 × 400 m) in metres. They're judged on lap time, not GPS distance.</p>
      </div>
      <label className="f">NOTES FOR THE ATHLETE<textarea value={d.notes || ""} placeholder="e.g. Even splits, not fast first reps" onChange={e => set("notes", e.target.value)} /></label>
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      <div className="row">
        {session && <button type="button" className="btn danger" disabled={busy} onClick={remove}>Delete</button>}
        {session && <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>Copy to next week</button>}
        <span className="sp" />
        <button type="button" className="btn" onClick={() => onDone()}>Cancel</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save session"}</button>
      </div>
    </div>
  );
}
