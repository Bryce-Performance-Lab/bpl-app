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
