"use client";
import { useState } from "react";
import { buildZones, fmt, parsePace, ZC, zone } from "@/lib/engine.js";
import { supabase } from "@/lib/supabase/client";
import type { Athlete } from "@/lib/data";

/** Add an athlete (invites them by email) or edit their details and test zones. */
export default function AthleteForm({ athlete, onSaved, onCancel }: { athlete?: Athlete | null; onSaved: (a: Athlete) => void; onCancel: () => void }) {
  const a = athlete, z = (c: string) => zone(a, c) || ({} as any);
  const [f, setF] = useState({
    name: a?.name || "", email: a?.email || "", event: a?.event || "", test_date: a?.test_date || "",
    b12: a ? fmt(z("T2").slow) : "", lt1: a?.lt1 ? fmt(a.lt1) : "", b34: a ? fmt(z("T4").slow) : "", lt2: a?.lt2 ? fmt(a.lt2) : "",
    hr: ZC.map(c => z(c).hr || ""),
  });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const clean = (v: string) => (v === "–" ? "" : v);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const raw = [f.b12, f.lt1, f.b34, f.lt2].map(clean), any = raw.some(Boolean);
    let zones = a?.zones || [], lt1 = a?.lt1 ?? null, lt2 = a?.lt2 ?? null;
    if (any) {
      const b = raw.map(parsePace);
      if (b.some(x => x == null)) { setErr("Enter all four paces as min:sec, e.g. 4:51, 3:27, 3:22, 3:08 (or leave them all empty until the test)."); return; }
      if (!(b[0] > b[1] && b[1] > b[2] && b[2] > b[3])) { setErr("Paces must get faster from the T1/T2 boundary to LT2 (e.g. 4:51, 3:27, 3:22, 3:08)."); return; }
      zones = buildZones(b[0], b[1], b[2], b[3], f.hr); lt1 = b[1]; lt2 = b[3];
    }
    const row = { name: f.name.trim(), email: f.email.trim().toLowerCase(), event: f.event.trim() || null, test_date: f.test_date || null, zones, lt1, lt2 };
    setBusy(true);
    const sb = supabase();
    const q = a ? sb.from("athletes").update(row).eq("id", a.id).select().single() : sb.from("athletes").insert(row).select().single();
    const { data, error } = await q; setBusy(false);
    if (error) { setErr(/duplicate|unique/i.test(error.message) ? "You've already added an athlete with that email." : error.message); return; }
    onSaved(data as Athlete);
  }
  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid2">
        <label className="f">NAME<input required value={f.name} onChange={e => set("name", e.target.value)} /></label>
        <label className="f">EMAIL (THEIR LOGIN)<input type="email" required value={f.email} onChange={e => set("email", e.target.value)} /></label>
        <label className="f">EVENT<input value={f.event} placeholder="e.g. 800 m / 1500 m" onChange={e => set("event", e.target.value)} /></label>
        <label className="f">LAST TEST DATE<input type="date" value={f.test_date} onChange={e => set("test_date", e.target.value)} /></label>
      </div>
      <div>
        <div className="lab" style={{ marginBottom: 6 }}>Zone boundaries from the lactate test (min:sec per km)</div>
        <div className="grid2">
          <label className="f">T1 / T2<input value={clean(f.b12)} placeholder="4:51" onChange={e => set("b12", e.target.value)} /></label>
          <label className="f">LT1 (T2 / T3)<input value={clean(f.lt1)} placeholder="3:27" onChange={e => set("lt1", e.target.value)} /></label>
          <label className="f">T3 / T4<input value={clean(f.b34)} placeholder="3:22" onChange={e => set("b34", e.target.value)} /></label>
          <label className="f">LT2 (T4 / T5)<input value={clean(f.lt2)} placeholder="3:08" onChange={e => set("lt2", e.target.value)} /></label>
        </div>
      </div>
      <div>
        <div className="lab" style={{ marginBottom: 6 }}>Heart rate per zone (optional)</div>
        <div className="grid2">{ZC.map((c, i) => <label key={c} className="f">{c} HR<input value={f.hr[i]} placeholder={["≤ 139", "140–158", "159–177", "178–190", "≥ 191"][i]} onChange={e => set("hr", f.hr.map((h, k) => k === i ? e.target.value : h))} /></label>)}</div>
      </div>
      {!a && <p className="note" style={{ margin: 0 }}>Next, you'll get an invite email ready to send. They sign up with this email and are linked to you automatically.</p>}
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      <div className="row"><span className="sp" /><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : a ? "Save" : "Add athlete and invite"}</button></div>
    </form>
  );
}
