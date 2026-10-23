// Bryce Performance Lab analysis engine.
// Reads .FIT files, joins split recordings, finds the planned reps and compares them with the athlete's zones.
// Plain JavaScript so the same code runs in the browser (on upload) and in tests.

export const ZC = ["T1", "T2", "T3", "T4", "T5"];
export const ZNAME = { T1: "Recovery", T2: "Aerobic endurance", T3: "Intense aerobic", T4: "Threshold", T5: "Above threshold" };
export const TAGS = ["Easy", "Long run", "Recovery", "Tempo", "Threshold", "VO2max", "Speed endurance", "Speed development", "Hills", "Race", "Strength", "Rest"];
export const SETTINGS = ["Road", "Track", "Grass", "Trail", "Treadmill", "Hills"];
export const TOL = 3; // s/km either side of a zone before a rep is called fast or slow
export const FIT_EPOCH = 631065600;

export const TEMPLATES = [
  { title: "Easy run", tag: "Easy", steps: [{ label: "", reps: 1, amount: 45, unit: "min", zone: "T2" }] },
  { title: "Long run", tag: "Long run", steps: [{ label: "", reps: 1, amount: 90, unit: "min", zone: "T2" }] },
  { title: "Threshold reps", tag: "Threshold", setting: "Road", steps: [{ label: "Warm-up", reps: 1, amount: 15, unit: "min", zone: "T2" }, { label: "Main", reps: 4, amount: 5, unit: "min", zone: "T4", recAmount: 90, recUnit: "sec", recZone: "T1" }, { label: "Cool-down", reps: 1, amount: 10, unit: "min", zone: "T1" }] },
  { title: "Tempo", tag: "Tempo", setting: "Road", steps: [{ label: "Warm-up", reps: 1, amount: 15, unit: "min", zone: "T2" }, { label: "Tempo", reps: 1, amount: 20, unit: "min", zone: "T3" }, { label: "Cool-down", reps: 1, amount: 10, unit: "min", zone: "T1" }] },
  { title: "Track 400s", tag: "Speed endurance", setting: "Track", steps: [{ label: "Warm-up", reps: 1, amount: 20, unit: "min", zone: "T2" }, { label: "Reps", reps: 8, amount: 400, unit: "m", zone: "T5", recAmount: 200, recUnit: "m", recZone: "T1" }, { label: "Cool-down", reps: 1, amount: 10, unit: "min", zone: "T1" }] },
  { title: "Recovery jog", tag: "Recovery", steps: [{ label: "", reps: 1, amount: 30, unit: "min", zone: "T1" }] },
  { title: "Rest day", tag: "Rest", steps: [] },
];
const TYPE_FIX = { Track: "Speed endurance", Intervals: "VO2max", Speed: "Speed development" };
export const tagOf = t => TYPE_FIX[t] || t;

/* ---------- formatting ---------- */
export function fmt(sec) { if (sec == null || !isFinite(sec)) return "–"; sec = Math.round(sec); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
export function parsePace(s) { const m = /^(\d{1,2}):(\d{2})$/.exec((s || "").trim()); return m ? +m[1] * 60 + +m[2] : null; }
export function dur(sec) { sec = Math.round(sec / 60); return sec >= 60 ? Math.floor(sec / 60) + "h " + String(sec % 60).padStart(2, "0") : sec + " min"; }
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function amt(v, u) { if (!+v) return ""; return u === "min" ? v + " min" : u === "sec" ? v + " s" : u === "km" ? v + " km" : v + " m"; }

/* ---------- zones ---------- */
export function zones(a) { return (a && a.zones) || []; }
export function zone(a, code) { return zones(a).find(z => z.code === code); }
export function zPace(z) { if (!z) return null; if (z.fast != null && z.slow != null) return (z.fast + z.slow) / 2; if (z.slow == null) return z.fast + 30; return z.slow - 10; }
export function zRange(z) { if (!z) return ""; if (z.slow == null) return "slower than " + fmt(z.fast); if (z.fast == null) return "faster than " + fmt(z.slow); return fmt(z.fast) + "–" + fmt(z.slow); }
export function zRangeShort(z) { if (!z) return ""; if (z.slow == null) return ">" + fmt(z.fast); if (z.fast == null) return "<" + fmt(z.slow); return fmt(z.fast) + "–" + fmt(z.slow); }
export function isDist(u) { return u === "km" || u === "m"; }
export function stepKm(s) { return s.unit === "km" ? +s.amount : (+s.amount || 0) / 1000; }
export function timeRange(z, km) {
  if (!z || !km) return ""; const f = z.fast != null ? z.fast * km : null, sl = z.slow != null ? z.slow * km : null;
  if (f == null) return "under " + fmt(sl); if (sl == null) return "over " + fmt(f); return fmt(f) + "–" + fmt(sl);
}
export function stepTarget(a, s) { const z = zone(a, s.zone); return isDist(s.unit) ? timeRange(z, stepKm(s)) + " per " + amt(s.amount, s.unit) : zRangeShort(z) + "/km"; }

/** Builds the five zones from the four boundaries entered after a test (all sec/km). */
export function buildZones(t1t2, lt1, t3t4, lt2, hr = []) {
  return [
    { code: "T1", fast: t1t2, slow: null, hr: hr[0] || "" },
    { code: "T2", fast: lt1, slow: t1t2, hr: hr[1] || "" },
    { code: "T3", fast: t3t4, slow: lt1, hr: hr[2] || "" },
    { code: "T4", fast: lt2, slow: t3t4, hr: hr[3] || "" },
    { code: "T5", fast: null, slow: lt2, hr: hr[4] || "" },
  ];
}

/* ---------- planned totals ---------- */
export function part(a, amount, unit, code) {
  const p = zPace(zone(a, code)); amount = +amount || 0;
  let sec = 0, km = 0;
  if (unit === "min") { sec = amount * 60; km = p ? sec / p : 0; }
  else if (unit === "sec") { sec = amount; km = p ? sec / p : 0; }
  else if (unit === "km") { km = amount; sec = p ? km * p : 0; }
  else if (unit === "m") { km = amount / 1000; sec = p ? km * p : 0; }
  return { sec, km };
}
export function totals(a, st) {
  const t = { sec: 0, km: 0, byZone: {} };
  (st || []).forEach(s => {
    const reps = Math.max(1, +s.reps || 1);
    const w = part(a, s.amount, s.unit, s.zone);
    t.sec += w.sec * reps; t.km += w.km * reps; t.byZone[s.zone] = (t.byZone[s.zone] || 0) + w.sec * reps;
    if (reps > 1 && +s.recAmount) { const r = part(a, s.recAmount, s.recUnit, s.recZone); t.sec += r.sec * (reps - 1); t.km += r.km * (reps - 1); t.byZone[s.recZone] = (t.byZone[s.recZone] || 0) + r.sec * (reps - 1); }
  });
  return t;
}
export function hardest(st) { let best = null; (st || []).forEach(s => { if (!best || ZC.indexOf(s.zone) > ZC.indexOf(best.zone)) best = s; }); return best; }
export function stepText(s) {
  const reps = +s.reps || 1, base = (reps > 1 ? reps + " × " : "") + amt(s.amount, s.unit) + " " + s.zone;
  const rec = reps > 1 && +s.recAmount ? " · rec " + amt(s.recAmount, s.recUnit) + " " + s.recZone : "";
  return (s.label ? s.label + ": " : "") + base + rec;
}
export function mainStep(st) { const q = (st || []).filter(x => ZC.indexOf(x.zone) >= 2); if (!q.length) return null; return q.reduce((a, b) => ZC.indexOf(b.zone) > ZC.indexOf(a.zone) ? b : a); }
/** Short headline for a session, e.g. "8 × 400 m" or "45 min". */
export function headline(steps) {
  const m = mainStep(steps) || (steps || [])[0]; if (!m) return "Rest";
  const reps = +m.reps || 1; return (reps > 1 ? reps + " × " : "") + amt(m.amount, m.unit);
}

/* ---------- .FIT parsing (records, laps, session) ---------- */
export function parseFIT(buf) {
  const dv = new DataView(buf), n = buf.byteLength;
  if (n < 14) throw new Error("short");
  const hs = dv.getUint8(0), dataSize = dv.getUint32(4, true);
  if (String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11)) !== ".FIT") throw new Error("sig");
  const end = Math.min(n, hs + dataSize);
  const defs = {}, out = { records: [], laps: [], session: null, sport: null };
  let p = hs, lastTs = 0;
  function readVal(base, size, little) {
    const b = base & 0x1F;
    try {
      switch (b) {
        case 0: case 2: case 10: case 13: { const v = dv.getUint8(p); return (v === 0xFF || (b === 10 && v === 0)) ? null : v; }
        case 1: { const v = dv.getInt8(p); return v === 0x7F ? null : v; }
        case 3: { if (size < 2) return null; const v = dv.getInt16(p, little); return v === 0x7FFF ? null : v; }
        case 4: case 11: { if (size < 2) return null; const v = dv.getUint16(p, little); return (v === 0xFFFF || (b === 11 && v === 0)) ? null : v; }
        case 5: { if (size < 4) return null; const v = dv.getInt32(p, little); return v === 0x7FFFFFFF ? null : v; }
        case 6: case 12: { if (size < 4) return null; const v = dv.getUint32(p, little); return (v === 0xFFFFFFFF || (b === 12 && v === 0)) ? null : v; }
        case 8: { if (size < 4) return null; const v = dv.getFloat32(p, little); return isFinite(v) ? v : null; }
        case 9: { if (size < 8) return null; const v = dv.getFloat64(p, little); return isFinite(v) ? v : null; }
        default: return null;
      }
    } catch (_) { return null; }
  }
  while (p < end) {
    const h = dv.getUint8(p++);
    let local, compressedTs = null;
    if (h & 0x80) { local = (h >> 5) & 3; const off = h & 0x1F; let ts = (lastTs & ~0x1F) + off; if (off < (lastTs & 0x1F)) ts += 0x20; compressedTs = ts; lastTs = ts; }
    else if (h & 0x40) {
      local = h & 0x0F; const dev = h & 0x20;
      p++; const arch = dv.getUint8(p++); const little = arch === 0;
      const gnum = dv.getUint16(p, little); p += 2;
      const nf = dv.getUint8(p++); const fields = [];
      for (let i = 0; i < nf; i++) { fields.push({ num: dv.getUint8(p), size: dv.getUint8(p + 1), base: dv.getUint8(p + 2) }); p += 3; }
      let devSize = 0;
      if (dev) { const nd = dv.getUint8(p++); for (let i = 0; i < nd; i++) { devSize += dv.getUint8(p + 1); p += 3; } }
      defs[local] = { gnum, little, fields, devSize };
      continue;
    } else local = h & 0x0F;
    const d = defs[local]; if (!d) throw new Error("nodef");
    const m = {};
    for (const f of d.fields) { m[f.num] = readVal(f.base, f.size, d.little); p += f.size; }
    p += d.devSize;
    if (m[253] != null) lastTs = m[253];
    const ts = m[253] ?? compressedTs;
    if (d.gnum === 20) {
      const sp = m[73] != null ? m[73] / 1000 : (m[6] != null ? m[6] / 1000 : null);
      out.records.push({ t: ts, d: m[5] != null ? m[5] / 100 : null, v: sp, hr: m[3] });
    } else if (d.gnum === 19) {
      out.laps.push({ start: m[2], time: (m[8] ?? m[7]) != null ? (m[8] ?? m[7]) / 1000 : null, dist: m[9] != null ? m[9] / 100 : null,
        v: m[110] != null ? m[110] / 1000 : (m[13] != null ? m[13] / 1000 : null), hr: m[15] });
    } else if (d.gnum === 18) {
      out.session = { start: m[2], time: (m[8] ?? m[7]) != null ? (m[8] ?? m[7]) / 1000 : null, dist: m[9] != null ? m[9] / 100 : null, hr: m[16], hrMax: m[17] };
      out.sport = m[5];
    }
  }
  out.records = out.records.filter(r => r.t != null);
  if (!out.records.length) throw new Error("norecords");
  return out;
}

/** Keeps a small copy of a file (one point every 2 s) so runs can be re-analysed without the original. */
export function compactPart(fit, name) {
  const R = fit.records, rec = []; let last = -99;
  R.forEach((r, i) => { if (r.t - last >= 2 || i === R.length - 1) { rec.push([r.t, r.d != null ? Math.round(r.d * 10) / 10 : null, r.hr ?? null, r.v != null ? Math.round(r.v * 100) / 100 : null]); last = r.t; } });
  return { name: name.slice(0, 80), first: R[0].t, last: R[R.length - 1].t, rec, laps: fit.laps, session: fit.session };
}
/** Joins warm-up, session and cool-down files into one run in time order. */
export function mergeParts(parts) {
  const ps = parts.slice().sort((a, b) => a.first - b.first);
  let off = 0, time = 0, distT = 0, hrSum = 0, hrW = 0; const records = [], laps = [];
  ps.forEach(p => {
    const d0 = (p.rec.find(x => x[1] != null) || [0, 0])[1]; let lastD = off;
    p.rec.forEach(([t, d, hr, v]) => { const dd = d != null ? off + d - d0 : null; records.push({ t, d: dd, hr, v }); if (dd != null) lastD = dd; });
    laps.push(...(p.laps || []));
    const pt = p.session && p.session.time != null ? p.session.time : (p.last - p.first);
    const pd = p.session && p.session.dist != null ? p.session.dist : (lastD - off);
    time += pt; distT += pd; if (p.session && p.session.hr) { hrSum += p.session.hr * pt; hrW += pt; }
    off = lastD;
  });
  return { records, laps, session: { time, dist: distT, hr: hrW ? hrSum / hrW : null } };
}

/* ---------- workout detection and comparison ---------- */
export function zoneOfPace(a, pace) { for (const z of zones(a)) { const lo = z.fast ?? -Infinity, hi = z.slow ?? Infinity; if (pace >= lo && pace < hi) return z.code; } return null; }
export function verdictFor(z, pace) {
  if (!z || !isFinite(pace)) return { k: "miss", t: "–" };
  if (z.fast != null && pace < z.fast - TOL) return { k: "fast", t: Math.round(z.fast - pace) + " s fast" };
  if (z.slow != null && pace > z.slow + TOL) return { k: "slow", t: Math.round(pace - z.slow) + " s slow" };
  return { k: "ok", t: "On target" };
}
export function verdictTime(z, sec, km) {
  if (!z || !isFinite(sec) || !km) return { k: "miss", t: "–" };
  const tol = Math.max(1, TOL * km);
  if (z.fast != null && sec < z.fast * km - tol) return { k: "fast", t: Math.round(z.fast * km - sec) + " s fast" };
  if (z.slow != null && sec > z.slow * km + tol) return { k: "slow", t: Math.round(sec - z.slow * km) + " s slow" };
  return { k: "ok", t: "On target" };
}

/* ---------- heart rate zones ---------- */
export const HR_TOL = 2; // bpm either side of a zone before HR is called high or low
export const HR_MIN_REP = 120; // reps shorter than this (s) are too short for HR to settle, so they aren't judged
/** Reads a coach-entered HR range such as "≤ 139", "140–158", "≥ 191", "191+". */
export function parseHr(s) {
  const t = String(s ?? "").replace(/\s+/g, "").replace(/bpm/i, "");
  if (!t) return null;
  let m;
  if ((m = /^(\d{2,3})[-–—](\d{2,3})$/.exec(t))) return { lo: +m[1], hi: +m[2] };
  if ((m = /^(?:≤|<=|<|max|upto)(\d{2,3})$/i.exec(t))) return { lo: null, hi: +m[1] };
  if ((m = /^(?:≥|>=|>|min)(\d{2,3})$/i.exec(t)) || (m = /^(\d{2,3})\+$/.exec(t))) return { lo: +m[1], hi: null };
  return null;
}
/** The athlete's HR zones as numbers: [{code, lo, hi}]. Empty if none are set. */
export function hrZones(a) { return zones(a).map(z => ({ code: z.code, ...(parseHr(z.hr) || {}) })).filter(z => z.lo != null || z.hi != null); }
export function hrZone(a, code) { return hrZones(a).find(z => z.code === code); }
export function hrRangeText(z) { if (!z) return ""; if (z.lo == null) return "≤ " + z.hi; if (z.hi == null) return "≥ " + z.lo; return z.lo + "–" + z.hi; }
export function zoneOfHr(a, hr) { for (const z of hrZones(a)) { if ((z.lo == null || hr >= z.lo) && (z.hi == null || hr <= z.hi)) return z.code; } return null; }
/** Compares an average HR with a zone's range. */
export function hrVerdict(z, hr) {
  if (!z || hr == null || !isFinite(hr)) return { k: "miss", t: "–" };
  if (z.hi != null && hr > z.hi + HR_TOL) return { k: "slow", t: Math.round(hr - z.hi) + " bpm high" };
  if (z.lo != null && hr < z.lo - HR_TOL) return { k: "fast", t: Math.round(z.lo - hr) + " bpm low" };
  return { k: "ok", t: "HR in zone" };
}

/** Analyses a merged run against the athlete's zones and the planned steps. */
export function analyse(fit, a, plan) {
  const R = fit.records, t0 = R[0].t;
  const T = R[R.length - 1].t - t0; const dist = new Float64Array(T + 1), hr = new Float64Array(T + 1).fill(NaN);
  const haveDist = R.some(r => r.d != null);
  if (!haveDist) { let acc = 0; for (let i = 0; i < R.length; i++) { if (i) { acc += (R[i - 1].v || 0) * (R[i].t - R[i - 1].t); } R[i].d = acc; } }
  let j = 0;
  for (let s = 0; s <= T; s++) {
    const tt = t0 + s; while (j < R.length - 2 && R[j + 1].t <= tt) j++;
    const A = R[j], B = R[Math.min(j + 1, R.length - 1)];
    const da = A.d ?? 0, db = B.d ?? da; const f = B.t > A.t ? Math.min(1, Math.max(0, (tt - A.t) / (B.t - A.t))) : 0;
    dist[s] = da + (db - da) * f; hr[s] = (B.t - A.t > 30 && tt > A.t + 5) ? NaN : (A.hr ?? NaN);
  }
  for (let s = 1; s <= T; s++) if (dist[s] < dist[s - 1]) dist[s] = dist[s - 1];
  const vAt = (s, w) => { const a0 = Math.max(0, s - w), b0 = Math.min(T, s + w); return b0 > a0 ? (dist[b0] - dist[a0]) / (b0 - a0) : 0; };
  const v10 = new Float64Array(T + 1); for (let s = 0; s <= T; s++) v10[s] = vAt(s, 5);

  const km = (fit.session && fit.session.dist) ? fit.session.dist / 1000 : dist[T] / 1000;
  let moving = 0; for (let s = 1; s <= T; s++) if (v10[s] > 1.2) moving++;
  const timer = (fit.session && fit.session.time) || moving;
  const hrs = Array.from(hr).filter(x => isFinite(x) && x > 0);
  const avgHr = fit.session && fit.session.hr ? fit.session.hr : (hrs.length ? hrs.reduce((p, c) => p + c, 0) / hrs.length : null);

  const zt = {}; for (let s = 1; s <= T; s++) { if (v10[s] <= 1.2) continue; const z = zoneOfPace(a, 1000 / v10[s]); if (z) zt[z] = (zt[z] || 0) + 1; }
  const hzt = {}; let hrMax = null;
  for (let s = 0; s <= T; s++) { const h = hr[s]; if (!isFinite(h) || h <= 0) continue; if (hrMax == null || h > hrMax) hrMax = h; const z = zoneOfHr(a, h); if (z) hzt[z] = (hzt[z] || 0) + 1; }
  const hrAvg = (s0, e0) => { let n = 0, t = 0; for (let s = Math.max(0, s0); s <= Math.min(T, e0); s++) { const h = hr[s]; if (isFinite(h) && h > 0) { n++; t += h; } } return n ? t / n : null; };

  const qIdx = ZC.indexOf("T3"); const sets = []; let cursor = 0;
  const steps = (plan || []);
  steps.forEach((st, si) => {
    if (ZC.indexOf(st.zone) < qIdx) return;
    const z = zone(a, st.zone); if (!z) return;
    const reps = Math.max(1, +st.reps || 1);
    const pSec = part(a, st.amount, st.unit, st.zone).sec || 60;
    const pDist = part(a, st.amount, st.unit, st.zone).km * 1000;
    const thrPace = z.slow != null ? z.slow : z.fast + 20; const thrV = 1000 / thrPace * 0.93;
    let blocks = null, source = "pace";
    if (fit.laps.length >= reps) {
      const qual = fit.laps.map((L, i) => ({ L, i })).filter(o => {
        const st0 = o.L.start != null ? o.L.start - t0 : null; const v = o.L.v ?? (o.L.dist && o.L.time ? o.L.dist / o.L.time : 0);
        if (st0 == null || st0 < cursor - 2 || v < thrV || !o.L.time) return false;
        if (isDist(st.unit)) return o.L.time >= pSec * 0.6 && o.L.time <= pSec * 1.6 && (!o.L.dist || Math.abs(o.L.dist - pDist) <= pDist * 0.2);
        return Math.abs(o.L.time - pSec) <= pSec * 0.15;
      });
      if (qual.length >= reps) { blocks = qual.slice(0, reps).map(o => { const s0 = o.L.start - t0; return { s: s0, e: Math.min(T, s0 + Math.round(o.L.time)) }; }); source = "laps"; }
    }
    if (!blocks) {
      const runs = []; let s = Math.max(0, cursor), inRun = false, rs = 0, gap = 0;
      for (; s <= T; s++) {
        const on = v10[s] >= thrV;
        if (on) { if (!inRun) { inRun = true; rs = s; } gap = 0; }
        else if (inRun) { gap++; if (gap > 8) { runs.push({ s: rs, e: s - gap }); inRun = false; gap = 0; } }
      }
      if (inRun) runs.push({ s: rs, e: T });
      const minLen = pSec * 0.5, maxLen = pSec * 1.8;
      blocks = runs.filter(b => (b.e - b.s) >= minLen && (b.e - b.s) <= maxLen + 30).slice(0, reps);
      blocks = blocks.map(b => (b.e - b.s) > pSec * 1.15 ? { s: b.s, e: Math.min(T, b.s + Math.round(pSec)) } : b);
    }
    const repsOut = [];
    for (let r = 0; r < reps; r++) {
      const b = blocks[r];
      if (!b) { repsOut.push({ miss: true }); continue; }
      const dd = dist[b.e] - dist[b.s], tt = b.e - b.s, pace = dd > 0 ? tt / (dd / 1000) : NaN;
      const hh = Array.from(hr.slice(b.s, b.e + 1)).filter(x => isFinite(x) && x > 0);
      const byTime = isDist(st.unit);
      const v = byTime ? verdictTime(z, tt, stepKm(st)) : verdictFor(z, pace);
      const lenDiff = byTime ? 0 : (tt - pSec) / pSec;
      const hrLate = hrAvg(b.s + Math.round(tt / 2), b.e), hv = tt >= HR_MIN_REP ? hrVerdict(hrZone(a, st.zone), hrLate) : { k: "miss", t: "" };
      repsOut.push({ s: b.s, e: b.e, sec: Math.round(tt), m: Math.round(dd), pace: Math.round(pace), hr: hh.length ? Math.round(hh.reduce((p, c) => p + c, 0) / hh.length) : null, hrLate: hrLate != null ? Math.round(hrLate) : null, hv: hv.k, hvt: hv.t, v: v.k, vt: v.t, len: Math.abs(lenDiff) > 0.12 ? (lenDiff > 0 ? "long" : "short") : "" });
    }
    if (blocks.length) cursor = blocks[blocks.length - 1].e;
    sets.push({ step: si, zone: st.zone, planned: stepText(st), byTime: isDist(st.unit), target: stepTarget(a, st), source, reps: repsOut });
  });

  const N = Math.min(320, T), trace = [];
  const gaps = []; for (let i = 1; i < R.length; i++) if (R[i].t - R[i - 1].t > 30) gaps.push([R[i - 1].t - t0, R[i].t - t0]);
  const nearGap = s => gaps.some(([a0, b0]) => s > a0 - 16 && s < b0 + 16);
  for (let k = 0; k <= N; k++) { const s = Math.round(k * T / N); const v = vAt(s, 15); trace.push([s, v > 1.2 && !nearGap(s) ? Math.round(1000 / v) : null]); }
  const hrTrace = trace.map(([s]) => { const h = hrAvg(s - 10, s + 10); return [s, h != null && !nearGap(s) ? Math.round(h) : null]; });

  const breaks = gaps.map(([s, e]) => ({ s, e }));
  const allReps = sets.flatMap(x => x.reps.filter(r => !r.miss));
  const firstS = allReps.length ? Math.min(...allReps.map(r => r.s)) : null, lastE = allReps.length ? Math.max(...allReps.map(r => r.e)) : null;
  const qi = steps.map((st, i) => ZC.indexOf(st.zone) >= qIdx ? i : -1).filter(i => i >= 0);
  const segStats = (s0, e0) => { let mv = 0; for (let s = Math.max(1, s0 + 1); s <= e0; s++) if (v10[s] > 1.2) mv++; const m = dist[e0] - dist[s0]; return { sec: mv, km: +(m / 1000).toFixed(2), pace: m > 50 ? Math.round(mv / (m / 1000)) : null }; };
  const segs = [];
  if (qi.length && firstS != null) {
    const pre = steps.slice(0, qi[0]), post = steps.slice(qi[qi.length - 1] + 1);
    const mk = (name, list, s0, e0) => {
      const st = segStats(s0, e0), z = zone(a, list[0].zone), p = totals(a, list);
      const h = hrAvg(s0, e0), hv = hrVerdict(hrZone(a, list[0].zone), h);
      return { name, planned: list.map(stepText).join(" + "), plannedSec: Math.round(p.sec), ...st, v: st.pace ? verdictFor(z, st.pace).k : "miss", vt: st.pace ? verdictFor(z, st.pace).t : "Not in the file", hr: h != null ? Math.round(h) : null, hv: hv.k, hvt: hv.t };
    };
    if (pre.length) segs.push(mk("Warm-up", pre, 0, firstS));
    if (post.length) segs.push(mk("Cool-down", post, lastE, T));
  }
  const found = sets.reduce((p, x) => p + x.reps.filter(r => !r.miss).length, 0), plannedReps = sets.reduce((p, x) => p + x.reps.length, 0);
  const onT = sets.reduce((p, x) => p + x.reps.filter(r => r.v === "ok").length, 0);
  // steady runs: average HR against the planned zone, and cardiac drift (pace per heartbeat, first half vs second half)
  let steadyHr = null, drift = null;
  if (!plannedReps) {
    const h0 = hardest(steps), hz = h0 ? hrZone(a, h0.zone) : null;
    if (avgHr) { const hv = hrVerdict(hz, avgHr); steadyHr = { zone: h0 ? h0.zone : null, range: hrRangeText(hz), k: hv.k, t: hv.t, actualZone: zoneOfHr(a, avgHr) }; }
    const mv = []; for (let s = 1; s <= T; s++) if (v10[s] > 1.2 && isFinite(hr[s]) && hr[s] > 0) mv.push(s);
    if (mv.length >= 20 * 60) {
      const ef = arr => { let sp = 0, h = 0; arr.forEach(s => { sp += v10[s]; h += hr[s]; }); return (sp / arr.length) / (h / arr.length); };
      const skip = Math.min(600, Math.floor(mv.length * 0.15)); const use = mv.slice(skip); const half = Math.floor(use.length / 2);
      const e1 = ef(use.slice(0, half)), e2 = ef(use.slice(half));
      drift = +(((e1 - e2) / e1) * 100).toFixed(1);
    }
  }
  return { km: +km.toFixed(2), sec: Math.round(timer), pace: km > 0 ? Math.round(timer / km) : null, hr: avgHr ? Math.round(avgHr) : null, hrMax: hrMax ? Math.round(hrMax) : null,
    hzt, hrTrace, steadyHr, drift, hasHrZones: hrZones(a).length > 0,
    zt, sets, found, plannedReps, onTarget: onT, trace, T, laps: fit.laps.length, breaks, segs, firstS, lastE, t0 };
}

/** Which part of the run a file was: warm-up, main session or cool-down. */
export function partRole(an, p) {
  if (!an || an.firstS == null) return null;
  const s = p.first - an.t0, e = p.last - an.t0;
  if (e <= an.firstS + 5) return "Warm-up"; if (s >= an.lastE - 5) return "Cool-down"; return "Main session";
}

/* ---------- charts (SVG strings; all text is escaped or numeric) ---------- */
export function paceChartSVG(an, athlete) {
  const W = 640, H = 170, L = 40, Rr = 8, Tp = 10, B = 22;
  const s0 = an.firstS != null ? Math.max(0, an.firstS - 30) : 0, s1 = an.lastE != null ? Math.min(an.T, an.lastE + 30) : an.T;
  const win = an.trace.filter(p => p[0] >= s0 && p[0] <= s1), pts = win.filter(p => p[1] != null); if (!pts.length) return "";
  const zs = zones(athlete); const bounds = zs.flatMap(z => [z.fast, z.slow]).filter(x => x != null);
  let lo = Math.min(...pts.map(p => p[1]), ...bounds) - 10, hi = Math.min(Math.max(...pts.map(p => p[1])), Math.max(...bounds, 0) + 60) + 10;
  lo = Math.max(lo, 120); hi = Math.min(Math.max(hi, lo + 60), 600);
  const CAP = 240, brks = (an.breaks || []).filter(b => b.e > s0 && b.s < s1), long = brks.filter(b => b.e - b.s > CAP);
  const cut = s => long.reduce((acc, b) => acc + Math.min(Math.max(s - (b.s + CAP), 0), (b.e - b.s) - CAP), 0);
  const DT = (s1 - s0) - (cut(s1) - cut(s0)) || 1;
  const X = s => L + ((s - s0) - (cut(s) - cut(s0))) / DT * (W - L - Rr), Y = p => Tp + (Math.min(Math.max(p, lo), hi) - lo) / (hi - lo) * (H - Tp - B);
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pace through the main session with detected reps">`;
  zs.forEach(z => { const a0 = Y(z.fast ?? lo), b0 = Y(z.slow ?? hi); if (b0 > a0) g += `<rect x="${L}" y="${a0.toFixed(1)}" width="${W - L - Rr}" height="${(b0 - a0).toFixed(1)}" fill="var(--z${esc(z.code.slice(1))})" opacity="0.13"/>`; });
  an.sets.forEach(st => st.reps.forEach((r, i) => { if (r.miss) return; g += `<rect x="${X(r.s).toFixed(1)}" y="${Tp}" width="${Math.max(2, X(r.e) - X(r.s)).toFixed(1)}" height="${H - Tp - B}" fill="var(--z${esc(st.zone.slice(1))})" opacity="0.18"/><text x="${((X(r.s) + X(r.e)) / 2).toFixed(1)}" y="${Tp + 10}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--fg)">${i + 1}</text>`; }));
  for (let p = Math.ceil(lo / 30) * 30; p <= hi; p += 30) g += `<line x1="${L}" x2="${W - Rr}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}" stroke="var(--line)" stroke-width="0.6"/><text x="${L - 5}" y="${(Y(p) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${fmt(p)}</text>`;
  const span = DT / 60, step = span <= 12 ? 1 : span <= 30 ? 5 : 10;
  for (let m = 0; s0 + m * 60 <= s1; m += step) { const s = s0 + m * 60; if (long.some(b => s > b.s - 60 && s < b.e + 60)) continue; g += `<text x="${X(s).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--muted)">${m}′</text>`; }
  brks.forEach(b => { const x0 = X(Math.max(b.s, s0)), w = Math.max(3, X(Math.min(b.e, s1)) - x0); g += `<rect x="${x0.toFixed(1)}" y="${Tp}" width="${w.toFixed(1)}" height="${H - Tp - B}" fill="var(--sunk)" stroke="var(--line)" stroke-dasharray="3 3"/>${w > 34 ? `<text x="${(x0 + w / 2).toFixed(1)}" y="${H - B - 6}" text-anchor="middle" font-size="9" fill="var(--muted)">break ${Math.round((b.e - b.s) / 60)}′</text>` : ""}`; });
  let d = "", pen = false; win.forEach(([s, p]) => { if (p == null) { pen = false; return; } d += (pen ? "L" : "M") + X(s).toFixed(1) + " " + Y(p).toFixed(1); pen = true; });
  g += `<path d="${d}" fill="none" stroke="var(--fg)" stroke-width="1.5"/></svg>`;
  return g;
}


/** Heart rate through the same window as the pace chart, with the athlete's HR zones as bands. */
export function hrChartSVG(an, athlete) {
  if (!an.hrTrace) return "";
  const W = 640, H = 150, L = 40, Rr = 8, Tp = 10, B = 22;
  const s0 = an.firstS != null ? Math.max(0, an.firstS - 30) : 0, s1 = an.lastE != null ? Math.min(an.T, an.lastE + 30) : an.T;
  const win = an.hrTrace.filter(p => p[0] >= s0 && p[0] <= s1), pts = win.filter(p => p[1] != null); if (pts.length < 2) return "";
  const hz = hrZones(athlete);
  let lo = Math.min(...pts.map(p => p[1])) - 8, hi = Math.max(...pts.map(p => p[1])) + 8;
  lo = Math.max(60, Math.floor(lo / 10) * 10); hi = Math.min(230, Math.ceil(hi / 10) * 10); if (hi - lo < 30) hi = lo + 30;
  const CAP = 240, brks = (an.breaks || []).filter(b => b.e > s0 && b.s < s1), long = brks.filter(b => b.e - b.s > CAP);
  const cut = s => long.reduce((acc, b) => acc + Math.min(Math.max(s - (b.s + CAP), 0), (b.e - b.s) - CAP), 0);
  const DT = (s1 - s0) - (cut(s1) - cut(s0)) || 1;
  const X = s => L + ((s - s0) - (cut(s) - cut(s0))) / DT * (W - L - Rr), Y = h => Tp + (hi - Math.min(Math.max(h, lo), hi)) / (hi - lo) * (H - Tp - B);
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Heart rate with heart-rate zones">`;
  hz.forEach(z => { const a0 = Y(z.hi ?? hi), b0 = Y(z.lo ?? lo); if (b0 > a0) g += `<rect x="${L}" y="${a0.toFixed(1)}" width="${W - L - Rr}" height="${(b0 - a0).toFixed(1)}" fill="var(--z${esc(z.code.slice(1))})" opacity="0.13"/>`; });
  an.sets.forEach(st => st.reps.forEach(r => { if (r.miss) return; g += `<rect x="${X(r.s).toFixed(1)}" y="${Tp}" width="${Math.max(2, X(r.e) - X(r.s)).toFixed(1)}" height="${H - Tp - B}" fill="var(--z${esc(st.zone.slice(1))})" opacity="0.14"/>`; }));
  for (let h = Math.ceil(lo / 20) * 20; h <= hi; h += 20) g += `<line x1="${L}" x2="${W - Rr}" y1="${Y(h).toFixed(1)}" y2="${Y(h).toFixed(1)}" stroke="var(--line)" stroke-width="0.6"/><text x="${L - 5}" y="${(Y(h) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${h}</text>`;
  const span = DT / 60, step = span <= 12 ? 1 : span <= 30 ? 5 : 10;
  for (let m = 0; s0 + m * 60 <= s1; m += step) { const s = s0 + m * 60; if (long.some(b => s > b.s - 60 && s < b.e + 60)) continue; g += `<text x="${X(s).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--muted)">${m}′</text>`; }
  brks.forEach(b => { const x0 = X(Math.max(b.s, s0)), w = Math.max(3, X(Math.min(b.e, s1)) - x0); g += `<rect x="${x0.toFixed(1)}" y="${Tp}" width="${w.toFixed(1)}" height="${H - Tp - B}" fill="var(--sunk)" stroke="var(--line)" stroke-dasharray="3 3"/>`; });
  let d = "", pen = false; win.forEach(([s, h]) => { if (h == null) { pen = false; return; } d += (pen ? "L" : "M") + X(s).toFixed(1) + " " + Y(h).toFixed(1); pen = true; });
  g += `<path d="${d}" fill="none" stroke="var(--red)" stroke-width="1.5"/></svg>`;
  return g;
}

/* ---------- progress vs similar sessions ---------- */
// A "session" here is a session row with its activity merged in: {id, date, title, tag, setting, steps, analysis, actual:{rpe, lactate}}
export function metrics(s, live) {
  const an = s.analysis; if (!an) return null;
  const ms = mainStep(s.steps), idx = ms ? (s.steps || []).indexOf(ms) : -1;
  const set = ms ? ((an.sets || []).find(x => x.step === idx) || (an.sets || [])[0]) : null;
  const reps = set ? set.reps.filter(r => !r.miss) : [];
  const byTime = !!(set && set.byTime);
  const avg = k => reps.length ? reps.reduce((p, c) => p + (c[k] || 0), 0) / reps.length : null;
  const hrs = reps.map(r => r.hr).filter(Boolean);
  const act = live || s.actual || {};
  const lac = (act.lactate || []).map(x => +x.v).filter(x => isFinite(x) && x > 0);
  const repNorm = !set ? an.pace : byTime ? (avg("sec") != null && ms ? avg("sec") / stepKm(ms) : null) : avg("pace");
  return { id: s.id, date: s.date, title: s.title, byTime, hasSet: !!set, n: reps.length, planned: set ? set.reps.length : 0, onT: set ? reps.filter(r => r.v === "ok").length : null,
    rep: repNorm, hr: hrs.length ? hrs.reduce((p, c) => p + c, 0) / hrs.length : an.hr, rpe: act.rpe ?? null,
    lac: lac.length ? Math.max(...lac) : null, km: an.km, structure: set ? set.planned : "Whole run", work: reps.reduce((p, c) => p + (c.sec || 0), 0) };
}
/** Last 6 earlier sessions with the same tag + setting and the main set in the same zone. */
export function similar(all, ses) {
  const type = tagOf(ses.tag), setting = ses.setting || "", ms = mainStep(ses.steps);
  return all.filter(s => s.id !== ses.id && s.analysis && s.date < ses.date && tagOf(s.tag) === type && (!setting || !s.setting || s.setting === setting))
    .filter(s => { const m2 = mainStep(s.steps); return ms && m2 ? m2.zone === ms.zone : !ms && !m2; })
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).reverse();
}
/** Everything the Compare view shows. */
export function compareData(all, ses, athlete, live) {
  const me = metrics(ses, live); if (!me) return null;
  const ms = mainStep(ses.steps), mz = ms ? zone(athlete, ms.zone) : null;
  const prev = similar(all, ses).map(s => metrics(s)).filter(Boolean);
  const crit = `${tagOf(ses.tag)}${ses.setting ? " · " + ses.setting : ""} · ${ms ? "main set in " + ms.zone + " (" + zRangeShort(mz) + "/km)" : "no main set"}`;
  const mean = k => { const v = prev.map(p => p[k]).filter(x => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const showRep = v => v == null ? "–" : fmt(v) + "/km";
  const chip = (label, curV, avgV, fmtV, unitWord, band) => {
    if (curV == null || avgV == null) return { label, value: curV == null ? "–" : fmtV(curV), note: avgV == null ? "no earlier data" : "avg " + fmtV(avgV), cls: "" };
    const d = curV - avgV, same = Math.abs(d) < band;
    return { label, value: fmtV(curV), note: (same ? "same as average" : `${unitWord(Math.abs(d))} ${d < 0 ? "lower" : "higher"} than average`) + ` (${fmtV(avgV)})`, cls: same ? "" : d < 0 ? "good" : "bad" };
  };
  const a = mean("rep"); let repChip;
  if (me.rep == null || a == null) repChip = chip(me.hasSet ? "Avg work pace" : "Avg pace", me.rep, a, showRep, x => x, 1);
  else { const d = me.rep - a, same = Math.abs(d) < 1;
    repChip = { label: me.hasSet ? "Avg work pace" : "Avg pace", value: showRep(me.rep), note: (same ? "same as average" : Math.abs(d).toFixed(1).replace(/\.0$/, "") + " s/km " + (d < 0 ? "faster" : "slower") + " than average") + ` (${showRep(a)})`, cls: same ? "" : d < 0 ? "good" : "bad" }; }
  const chips = [repChip,
    chip("Avg rep HR", me.hr, mean("hr"), v => Math.round(v) + " bpm", x => Math.round(x) + " bpm", 1.5),
    chip("RPE", me.rpe, mean("rpe"), v => (+v).toFixed(1).replace(/\.0$/, ""), x => x.toFixed(1).replace(/\.0$/, ""), 0.5),
    chip("Lactate", me.lac, mean("lac"), v => (+v).toFixed(1) + " mmol/L", x => x.toFixed(1), 0.2)];
  const rows = [...prev, { ...me, me: true }];
  return { me, prev, crit, chips, rows, showRep };
}
export function miniTrendSVG(rows, key, title, show, invert) {
  const pts = rows.map((r, i) => ({ i, v: r[key], me: r.me, d: r.date })).filter(p => p.v != null && isFinite(p.v));
  if (pts.length < 2) return "";
  const W = 300, H = 120, L = 44, R = 10, T = 16, B = 22;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v)); const pad = Math.max((hi - lo) * 0.15, key === "rep" ? 2 : 1); lo -= pad; hi += pad;
  const X = i => L + (rows.length === 1 ? 0 : i / (rows.length - 1)) * (W - L - R);
  const Y = v => invert ? T + (v - lo) / (hi - lo) * (H - T - B) : T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(title)} across similar sessions"><text x="${L}" y="11" font-size="10" font-weight="700" fill="var(--muted)">${esc(title)}</text>`;
  [lo + pad, hi - pad].forEach(v => { g += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-width="0.6"/><text x="${L - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${esc(show(v))}</text>`; });
  g += `<polyline fill="none" stroke="var(--muted)" stroke-width="1.2" points="${pts.map(p => X(p.i).toFixed(1) + "," + Y(p.v).toFixed(1)).join(" ")}"/>`;
  pts.forEach(p => { g += `<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${p.me ? 5 : 3.5}" fill="${p.me ? "var(--royal)" : "var(--surface)"}" stroke="${p.me ? "var(--royal)" : "var(--muted)"}" stroke-width="1.5"/>`; });
  rows.forEach((r, i) => { g += `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${r.me ? "var(--fg)" : "var(--muted)"}" font-weight="${r.me ? 700 : 400}">${r.me ? "Now" : esc(r.date.slice(8) + "/" + r.date.slice(5, 7))}</text>`; });
  return g + `</svg>`;
}

/* ---------- dates ---------- */
export function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
export function monday(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function fromIso(s) { return new Date(s + "T00:00"); }

/* ---------- note themes (why drift might have happened) ---------- */
// Keyword themes linked to cardiac drift. Matching is simple and offline; "no wind" / "not hot" are ignored.
export const THEMES = [
  { key: "heat", label: "Heat / humidity", re: /\b(hot|heat|humid\w*|warm(?![\s-]?(?:up|down))\w*|sunny|sun|sweat\w*|muggy|steamy|sticky|scorch\w*|boiling|[23]\d ?(?:°|deg\w*))/g },
  { key: "wind", label: "Wind", re: /\b(wind(?:y|s)?|headwinds?|gust\w*|breez\w*)\b/g },
  { key: "sleep", label: "Poor sleep / tired", re: /\b(sleep\w*|slept|tired\w*|fatigu\w*|exhaust\w*|knackered|wrecked|lethargic|drained|no energy|low energy|(?:felt|feeling) flat)\b/g },
  { key: "ill", label: "Illness", re: /\b(sick|ill|unwell|flu|virus|sore throat|congest\w*|blocked nose|runny nose|covid|fever|(?:a|head|chest) cold|coming down with)\b/g },
  { key: "fuel", label: "Fuel / hydration", re: /\b(dehydrat\w*|thirst\w*|hungry|bonk\w*|cramp\w*|fasted|empty stomach|no breakfast|(?:didn't|didnt|hadn't|hadnt) eat\w*|no water|no fuel|under ?fuel\w*)\b/g },
  { key: "stress", label: "Stress / busy", re: /\b(stress\w*|anxious|anxiety|nervous|busy|long day|big day|exams?|work)\b/g },
  { key: "legs", label: "Heavy or sore legs", re: /\b(heavy legs?|legs? (?:were|felt|feeling) (?:heavy|dead|sore|tired)|sore|doms|tight\w*|stiff\w*|niggl\w*)\b/g },
  { key: "terrain", label: "Hills / terrain", re: /\b(hill\w*|uphill|climb\w*|trail\w*|sand\w*|mud\w*|grass|soft ground|rough)\b/g },
  { key: "pacing", label: "Started too fast", re: /\b(too fast|too quick|went out (?:hard|fast|quick)|started (?:fast|quick|hard)|pushed (?:early|too early))\b/g },
  { key: "late", label: "Late night / alcohol", re: /\b(drinks|drinking|alcohol|beers?|wine|hungover|hangover|late night|big night|party)\b/g },
  { key: "travel", label: "Travel / altitude", re: /\b(travel\w*|flight|flew|jet ?lag\w*|altitude)\b/g },
  { key: "cycle", label: "Menstrual cycle", re: /\b(period|menstrua\w*|time of (?:the )?month|pms)\b/g },
];
const POS = /^\s*(?:really |very |so )?(?:well|great|good|fine|ok|okay|heaps)\b/; // "slept well"
const NEG = /\b(no|not|without|wasn'?t|isn'?t|didn'?t|never|zero|hardly)\s+(?:\w+\s+)?$/;
/** Themes mentioned in a note, with the words that triggered them. */
export function detectThemes(text) {
  const t = String(text || "").toLowerCase().replace(/[’]/g, "'");
  if (!t.trim()) return [];
  const out = [];
  for (const th of THEMES) {
    th.re.lastIndex = 0; let m; const words = [];
    while ((m = th.re.exec(t))) { const before = t.slice(Math.max(0, m.index - 20), m.index); const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14); if (!NEG.test(before) && !POS.test(after)) words.push(m[0]); }
    if (words.length) out.push({ key: th.key, label: th.label, words: Array.from(new Set(words)) });
  }
  return out;
}
/** Across runs with a drift figure: average drift when each theme was mentioned vs when it wasn't. */
export function driftPatterns(runs) {
  // runs: [{id, date, title, drift, note}]
  const avg = a => a.length ? a.reduce((p, c) => p + c, 0) / a.length : null;
  const tagged = runs.filter(r => r.drift != null && isFinite(r.drift)).map(r => ({ ...r, themes: detectThemes(r.note) }));
  const rows = THEMES.map(th => {
    const yes = tagged.filter(r => r.themes.some(x => x.key === th.key)), no = tagged.filter(r => !r.themes.some(x => x.key === th.key));
    return { key: th.key, label: th.label, n: yes.length, with: avg(yes.map(r => r.drift)), without: avg(no.map(r => r.drift)), runs: yes };
  }).filter(r => r.n > 0).sort((a, b) => (b.with - (b.without ?? 0)) - (a.with - (a.without ?? 0)));
  const unexplained = tagged.filter(r => r.drift >= 5 && !r.themes.length);
  return { runs: tagged, rows, unexplained, overall: avg(tagged.map(r => r.drift)) };
}
