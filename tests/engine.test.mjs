import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFIT, compactPart, mergeParts, analyse, buildZones, compareData, TEMPLATES, fmt, paceChartSVG } from "../lib/engine.js";

const fx = n => { const b = readFileSync(new URL("./fixtures/" + n, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const athlete = { zones: buildZones(291, 207, 202, 188) };   // Test client 1
const run = (files, steps) => analyse(mergeParts(files.map(f => compactPart(parseFIT(fx(f)), f))), athlete, steps);
const thr = TEMPLATES.find(t => t.title === "Threshold reps").steps;
const trk = TEMPLATES.find(t => t.title === "Track 400s").steps;

test("threshold 4 x 5 min found from pace changes despite 1 km auto-laps", () => {
  const an = run(["threshold.fit"], thr);
  assert.equal(an.found, 4); assert.equal(an.plannedReps, 4);
  assert.equal(an.sets[0].source, "pace");
  an.sets[0].reps.forEach(r => assert.ok(Math.abs(r.pace - 195) <= 4, "rep pace " + r.pace));
});
test("track 8 x 400 m judged on lap time, not GPS distance", () => {
  const an = run(["track.fit"], trk);
  assert.equal(an.sets[0].source, "laps");
  assert.deepEqual(an.sets[0].reps.map(r => r.sec), [72, 73, 74, 76, 71, 78, 73, 74]);
  assert.equal(an.onTarget, 7);   // 78 s is over 1:15 (76 s is inside the 1.2 s tolerance)
});
test("split warm-up / session / cool-down files are joined", () => {
  const an = run(["part1_warmup.fit", "part2_session.fit", "part3_cooldown.fit"], thr);
  assert.equal(an.found, 4); assert.ok(an.breaks.length >= 2); assert.equal(an.segs.length, 2);
  assert.ok(paceChartSVG(an, athlete).startsWith("<svg"));
});
test("easy run has no reps and a steady pace", () => {
  const an = run(["easy.fit"], TEMPLATES[0].steps);
  assert.equal(an.plannedReps, 0); assert.equal(fmt(an.pace), "4:40");
});
test("compare picks the last 6 similar threshold sessions regardless of rep length", () => {
  const H = JSON.parse(readFileSync(new URL("./fixtures/hist.json", import.meta.url)));
  const steps = (unit, amt, n) => [{ label: "Warm-up", reps: 1, amount: 15, unit: "min", zone: "T2" }, { label: "Main", reps: n, amount: amt, unit, zone: "T4", recAmount: 90, recUnit: "sec", recZone: "T1" }, { label: "Cool-down", reps: 1, amount: 10, unit: "min", zone: "T1" }];
  const all = H.map(([f, paces, unit, amt, hr, rpe, lac, date], i) => { const st = steps(unit, amt, paces.length);
    return { id: "h" + i, date, tag: "Threshold", setting: "Road", steps: st, analysis: run([f], st), actual: { rpe, lactate: [{ at: "End", v: lac }] } }; });
  const cur = { id: "now", date: "2026-10-20", tag: "Threshold", setting: "Road", steps: thr, analysis: run(["s_improve.fit"], thr), actual: { rpe: 6, lactate: [{ v: 3.4 }] } };
  const c = compareData([...all, cur], cur, athlete);
  assert.equal(c.prev.length, 6);
  assert.equal(c.chips[0].cls, "good");
});

test("heart rate is judged against the athlete's HR zones", async () => {
  const { hrChartSVG } = await import("../lib/engine.js");
  const hrA = { zones: buildZones(291, 207, 202, 188, ["≤ 139", "140–158", "159–177", "178–190", "≥ 191"]) };
  const an = analyse(mergeParts([compactPart(parseFIT(fx("threshold.fit")), "threshold.fit")]), hrA, thr);
  assert.ok(an.hasHrZones && an.hzt.T4 > 0);
  an.sets[0].reps.forEach(r => assert.equal(r.hv, "ok", "rep HR " + r.hrLate));
  assert.ok(hrChartSVG(an, hrA).startsWith("<svg"));
  const easy = analyse(mergeParts([compactPart(parseFIT(fx("easy.fit")), "easy.fit")]), hrA, TEMPLATES[0].steps);
  assert.equal(easy.steadyHr.k, "ok"); assert.ok(easy.drift != null && Math.abs(easy.drift) < 5);
  const trk = analyse(mergeParts([compactPart(parseFIT(fx("track.fit")), "track.fit")]), hrA, trk2());
  trk.sets[0].reps.forEach(r => assert.equal(r.hv, "miss"));   // 400 m reps are too short to judge HR
});
function trk2() { return TEMPLATES.find(t => t.title === "Track 400s").steps; }

test("note themes are detected, negations ignored, and set against drift", async () => {
  const { detectThemes, driftPatterns } = await import("../lib/engine.js");
  const k = t => detectThemes(t).map(x => x.key);
  assert.deepEqual(k("Heat and wind made it harder"), ["heat", "wind"]);
  assert.deepEqual(k("no wind, slept well, good warm-up"), []);
  assert.deepEqual(k("Getting a cold, legs were heavy"), ["ill", "legs"]);
  const p = driftPatterns([{ id: 1, date: "2026-10-01", drift: 9, note: "really hot" }, { id: 2, date: "2026-10-02", drift: 8, note: "humid and sticky" }, { id: 3, date: "2026-10-03", drift: 2, note: "felt good" }, { id: 4, date: "2026-10-04", drift: 7, note: "" }]);
  assert.equal(p.rows[0].key, "heat"); assert.equal(p.rows[0].n, 2); assert.equal(p.unexplained.length, 1);
});

test("GPS start point and watch temperature are read; thermal strain only on hot days", async () => {
  const { thermalStrain } = await import("../lib/engine.js");
  const part = compactPart(parseFIT(fx("hot_easy.fit")), "hot_easy.fit");
  assert.deepEqual(part.pos, { lat: -37.89, lon: 145.06 });
  const an = analyse(mergeParts([part]), athlete, TEMPLATES[0].steps);
  assert.equal(an.watchTemp.rise, 3);
  assert.equal(thermalStrain(an, { temp: 30, feels: 30, dew: 10 }).t, "Marked rise");
  assert.equal(thermalStrain(an, { temp: 15, feels: 14, dew: 8 }), null);
});

test("early-season heat scores harder than the same heat in mid-summer", async () => {
  const { heatStress, seasonOf } = await import("../lib/engine.js");
  assert.equal(seasonOf(-37.9, "2026-10-22T03:00:00Z"), "Spring"); assert.equal(seasonOf(51.5, "2026-10-22T03:00:00Z"), "Autumn");
  const w = { temp: 29, feels: 30, dew: 10, tempMax: 30, lat: -37.89 };
  const spring = heatStress({ ...w, start: "2026-10-22T03:00:00Z", context: { avgMax: 22.4, hotDays: 1, humidDays: 0 } }, 0);
  const summer = heatStress({ ...w, start: "2027-02-10T03:00:00Z", context: { avgMax: 29, hotDays: 11, humidDays: 2 } }, 4);
  assert.ok(spring.level > summer.level); assert.equal(spring.acc.level, 0); assert.equal(summer.acc.level, 2);
});
