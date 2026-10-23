"use client";
import { useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";
import { analyse, compactPart, mergeParts, parseFIT, ZC } from "@/lib/engine.js";
import { supabase } from "@/lib/supabase/client";
import type { Activity, Athlete, Plan } from "@/lib/data";
import AnalysisView from "./AnalysisView";
import { fetchWeather } from "@/lib/weather";

const GUIDES = [
  { name: "Garmin Connect", steps: ["On a computer, open connect.garmin.com and sign in.", "Open the activity.", "Click the gear icon, then Export Original.", "Drop the downloaded .zip here (no need to unzip)."] },
  { name: "COROS", steps: ["Open COROS Training Hub (t.coros.com) on a computer.", "Open the activity.", "Choose Export and pick .fit.", "Drop the file here."] },
  { name: "Strava", steps: ["Open the activity on strava.com on a computer.", "Click the ··· menu, then Export Original.", "Drop the file here."] },
];

type Pending = { name: string; bytes: Uint8Array };

/** Upload .FIT files for a planned session, preview the analysis, add RPE / lactate / a note, then save. */
export default function RunLogger({ athlete, plan, onSaved, onCancel }: { athlete: Athlete; plan: Plan; onSaved: (a: Activity | null) => void; onCancel?: () => void }) {
  const ex = plan.activity;
  const [parts, setParts] = useState<any[]>(ex?.parts || []);
  const [pending, setPending] = useState<Pending[]>([]);
  const [rpe, setRpe] = useState<number | null>(ex?.rpe ?? null);
  const [comment, setComment] = useState(ex?.comment || "");
  const [lacs, setLacs] = useState<{ at: string; v: string }[]>((ex?.lactate || []).map(l => ({ at: l.at || "", v: String(l.v ?? "") })));
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [over, setOver] = useState(false), [guide, setGuide] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [weather, setWeather] = useState<any>(ex?.weather || null);
  // look up the weather for the run's start point and time (Open-Meteo)
  useEffect(() => {
    const ps = parts.slice().sort((a, b) => a.first - b.first), p0 = ps.find(p => p.pos);
    if (!p0) { if (!parts.length) setWeather(null); return; }
    const first = ps[0].first, last = ps[ps.length - 1].last;
    if (weather && weather.lat === p0.pos.lat && weather.lon === p0.pos.lon && weather.start === new Date((first + 631065600) * 1000).toISOString()) return;
    let live = true; fetchWeather(p0.pos, first, last).then(w => { if (live) setWeather(w); });
    return () => { live = false; };
  }, [parts]); // eslint-disable-line react-hooks/exhaustive-deps

  const an = parts.length ? analyse(mergeParts(parts), athlete, plan.steps) : null;
  const nReps = Math.max(0, ...plan.steps.filter(s => ZC.indexOf(s.zone) >= 2).map(s => +s.reps || 1));
  const when = ["Pre-session", "End of warm-up", ...Array.from({ length: nReps }, (_, i) => "After rep " + (i + 1)), "End of main set", "3 min post", "End of session"];

  async function addFiles(list: FileList | File[]) {
    setErr(""); setMsg("");
    const files = Array.from(list), bad: string[] = [], dup: string[] = [];
    const nextParts = parts.slice(), nextPending = pending.slice();
    for (const f of files) {
      const raw = new Uint8Array(await f.arrayBuffer());
      let entries: Pending[] = [];
      if (/\.zip$/i.test(f.name)) {
        try { const z = unzipSync(raw); entries = Object.entries(z).filter(([n]) => /\.fit$/i.test(n)).map(([n, b]) => ({ name: n.split("/").pop()!, bytes: b })); } catch { bad.push(f.name); continue; }
        if (!entries.length) { bad.push(f.name); continue; }
      } else entries = [{ name: f.name, bytes: raw }];
      for (const e of entries) {
        try {
          const buf = e.bytes.buffer.slice(e.bytes.byteOffset, e.bytes.byteOffset + e.bytes.byteLength) as ArrayBuffer;
          const p = compactPart(parseFIT(buf), e.name);
          if (nextParts.some(x => x.first === p.first)) { dup.push(e.name); continue; }
          nextParts.push(p); nextPending.push(e);
        } catch { bad.push(e.name); }
      }
    }
    nextParts.sort((a, b) => a.first - b.first);
    setParts(nextParts); setPending(nextPending);
    if (bad.length) setErr(`${bad.join(", ")} couldn't be read as a run. Download the original file from your watch app (see "How to get the file") and try again.`);
    else if (dup.length) setMsg("Already added: " + dup.join(", "));
    else if (nextParts.length > 1) setMsg(nextParts.length + " files joined into one session.");
  }

  function removePart(i: number) {
    const p = parts[i]; setParts(parts.filter((_, k) => k !== i)); setPending(pending.filter(x => x.name !== p.name));
  }

  async function save() {
    if (!parts.length) { setErr("Add the run's .FIT file first."); return; }
    setBusy(true); setErr("");
    const sb = supabase(); const files = [...(ex?.files || [])];
    try {
      for (const f of pending) {
        const path = `${athlete.id}/${plan.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
        const { error } = await sb.storage.from("fit-files").upload(path, new Blob([f.bytes as BlobPart]), { contentType: "application/octet-stream" });
        if (error) throw error; files.push(path);
      }
      const row = {
        athlete_id: athlete.id, session_id: plan.id, date: plan.date, km: an?.km ?? null, duration_sec: an?.sec ?? null, rpe, comment: comment.trim() || null,
        lactate: lacs.filter(l => l.v !== "" && isFinite(+l.v)).map(l => ({ at: l.at, v: +l.v })), parts, analysis: an, files,
      };
      const { data, error } = await sb.from("activities").upsert(row, { onConflict: "session_id" }).select().single();
      if (error) throw error;
      // weather is saved separately so a run still saves if the weather column isn't set up yet
      let saved = data as Activity;
      if (weather || ex?.weather) { const w = await sb.from("activities").update({ weather }).eq("id", saved.id).select().single(); if (!w.error) saved = w.data as Activity; }
      setPending([]); onSaved(saved);
    } catch (e: any) {
      setErr("Couldn't save: " + (e?.message || "try again in a moment."));
    } finally { setBusy(false); }
  }

  async function removeRun() {
    if (!ex) return;
    setBusy(true); const sb = supabase();
    if (ex.files?.length) await sb.storage.from("fit-files").remove(ex.files);
    const { error } = await sb.from("activities").delete().eq("id", ex.id);
    setBusy(false);
    if (error) setErr("Couldn't remove: " + error.message); else onSaved(null);
  }

  return (
    <div className="stack">
      <label className={"drop" + (over ? " on" : "")} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
        <b>{parts.length ? "Add more files" : "Drag your .FIT files here"}</b>
        <span className="note">or click to choose. Recorded the warm-up, session and cool-down separately? Add them all and they're joined. Garmin .zip files are fine.</span>
        <input ref={input} type="file" multiple accept=".fit,.zip" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      </label>
      <div>
        <div className="lab" style={{ marginBottom: 4 }}>How to get the file</div>
        {GUIDES.map(g => (
          <div key={g.name} style={{ border: "1px solid var(--line)", borderRadius: 6, marginBottom: 4 }}>
            <button type="button" className="btn" aria-expanded={guide === g.name} onClick={() => setGuide(guide === g.name ? null : g.name)} style={{ width: "100%", justifyContent: "space-between", border: 0, fontWeight: 700 }}><span>{g.name}</span><span aria-hidden="true">{guide === g.name ? "–" : "+"}</span></button>
            {guide === g.name && <ol style={{ margin: "0 0 10px", paddingLeft: 32, fontSize: 12.5 }}>{g.steps.map(s => <li key={s}>{s}</li>)}</ol>}
          </div>
        ))}
      </div>
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      {msg && <p className="note" role="status" style={{ margin: 0 }}>{msg}</p>}
      {an && <AnalysisView an={an} athlete={athlete} steps={plan.steps} parts={parts} onRemovePart={removePart} note={comment} weather={weather} />}

      <div>
        <div className="lab" style={{ marginBottom: 6 }}>How hard was it? (RPE 1–10)</div>
        <div className="rpe" role="group" aria-label="Rate of perceived exertion">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(rpe === n ? null : n)}>{n}</button>)}
        </div>
      </div>
      <div>
        <div className="row" style={{ marginBottom: 6 }}><span className="lab">Lactate readings (optional)</span><span className="sp" /><button type="button" className="btn sm" onClick={() => setLacs([...lacs, { at: "", v: "" }])}>+ Add reading</button></div>
        {lacs.map((l, i) => (
          <div key={i} className="row" style={{ marginBottom: 6, alignItems: "flex-end" }}>
            <label className="f" style={{ flex: 2, minWidth: 160 }}>WHEN<input list="lacWhen" value={l.at} placeholder="e.g. After rep 4" onChange={e => setLacs(lacs.map((x, k) => k === i ? { ...x, at: e.target.value } : x))} /></label>
            <label className="f" style={{ flex: 1, minWidth: 90 }}>MMOL/L<input type="number" step="0.1" min="0" inputMode="decimal" value={l.v} onChange={e => setLacs(lacs.map((x, k) => k === i ? { ...x, v: e.target.value } : x))} /></label>
            <button type="button" className="btn sm danger" aria-label="Remove reading" onClick={() => setLacs(lacs.filter((_, k) => k !== i))}>✕</button>
          </div>
        ))}
        <datalist id="lacWhen">{when.map(o => <option key={o} value={o} />)}</datalist>
      </div>
      <label className="f">NOTE FOR YOUR COACH<textarea value={comment} placeholder="How it felt, conditions, anything unusual" onChange={e => setComment(e.target.value)} /></label>
      <div className="row">
        {ex && <button type="button" className="btn danger" disabled={busy} onClick={removeRun}>Remove run</button>}
        <span className="sp" />
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
        <button type="button" className="btn primary" disabled={busy || !parts.length} onClick={save}>{busy ? "Saving…" : "Save run"}</button>
      </div>
    </div>
  );
}
