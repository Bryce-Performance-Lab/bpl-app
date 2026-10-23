// Checks logins, linking and data isolation against a LOCAL Supabase (npx supabase start).
import { createClient } from "@supabase/supabase-js";
const URL = "http://127.0.0.1:54321", ANON = process.env.ANON;
const mk = () => createClient(URL, ANON, { auth: { persistSession: false } });
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const pw = "Test-password-123";

const coach = mk();
let r = await coach.auth.signUp({ email: "rileymacbryce@gmail.com", password: pw });
ok(!r.error, "coach can sign up " + (r.error?.message || ""));
let p = await coach.from("profiles").select("role").single(); ok(p.data?.role === "coach", "coach gets coach role");

const stranger = mk();
ok((await stranger.rpc("can_sign_up", { p_email: "nobody@x.com" })).data === false, "can_sign_up false for stranger");
r = await stranger.auth.signUp({ email: "nobody@x.com", password: pw });
ok(!!r.error, "uninvited email cannot sign up (" + r.error?.message + ")");

r = await coach.from("athletes").insert({ name: "Test Athlete", email: "Ath1@Example.com", zones: [] }).select().single();
ok(!r.error && r.data.email === "ath1@example.com", "coach adds athlete (email lower-cased) " + (r.error?.message || ""));
const aid = r.data.id;
r = await coach.from("athletes").insert({ name: "Other", email: "ath2@example.com" }).select().single(); const aid2 = r.data.id;
r = await coach.from("sessions").insert([{ athlete_id: aid, date: "2026-10-22", title: "Track 400s", tag: "Speed endurance" }, { athlete_id: aid2, date: "2026-10-22", title: "Secret", tag: "Easy" }]).select();
ok(!r.error && r.data.length === 2, "coach creates sessions");
const sid = r.data[0].id;

const ath = mk();
ok((await ath.rpc("can_sign_up", { p_email: "ath1@example.com" })).data === true, "can_sign_up true for invited");
r = await ath.auth.signUp({ email: "ath1@example.com", password: pw });
ok(!r.error, "invited athlete signs up " + (r.error?.message || ""));
p = await ath.from("profiles").select("role").single(); ok(p.data?.role === "athlete", "athlete role");
r = await ath.from("athletes").select("id,user_id"); ok(r.data.length === 1 && r.data[0].id === aid && r.data[0].user_id, "athlete auto-linked and sees only own record");
r = await ath.from("sessions").select("title"); ok(r.data.length === 1 && r.data[0].title === "Track 400s", "athlete sees only own sessions");
r = await ath.from("sessions").update({ title: "hacked" }).eq("id", sid).select(); ok(!r.data?.length, "athlete cannot edit sessions");
r = await ath.from("athletes").insert({ name: "x", email: "x@x.com", coach_id: r.data?.[0]?.id }).select(); ok(!!r.error, "athlete cannot add athletes");
r = await ath.from("activities").insert({ athlete_id: aid, session_id: sid, date: "2026-10-22", rpe: 8, coach_comment: "fake" }).select().single();
ok(!r.error && r.data.coach_comment === null, "athlete logs run; cannot write coach comment " + (r.error?.message || ""));
const actId = r.data.id;
r = await ath.from("activities").insert({ athlete_id: aid2, date: "2026-10-22" }).select(); ok(!!r.error, "athlete cannot log runs for others");
r = await coach.from("activities").update({ coach_comment: "Great work" }).eq("id", actId).select().single(); ok(r.data?.coach_comment === "Great work", "coach comments");
r = await ath.from("activities").update({ rpe: 7 }).eq("id", actId).select().single(); ok(r.data?.coach_comment === "Great work" && r.data.rpe == 7, "athlete edit keeps coach comment");
r = await ath.storage.from("fit-files").upload(aid + "/test.fit", new Blob(["abc"]), { upsert: true }); ok(!r.error, "athlete uploads own file " + (r.error?.message || ""));
r = await ath.storage.from("fit-files").upload(aid2 + "/test.fit", new Blob(["abc"])); ok(!!r.error, "athlete cannot upload to others");
r = await coach.storage.from("fit-files").download(aid + "/test.fit"); ok(!r.error, "coach downloads athlete file");

// athlete who signed up before being added: link on add
const coach2 = mk();
r = await coach2.auth.signUp({ email: "fake-coach@x.com", password: pw }); ok(!!r.error, "second coach email cannot sign up");
const anon = mk();
r = await anon.from("athletes").select(); ok(!r.data?.length, "logged-out sees nothing");
