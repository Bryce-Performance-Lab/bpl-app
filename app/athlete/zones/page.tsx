"use client";
import { fmt, zRange, ZNAME } from "@/lib/engine.js";
import { useAthlete, NotLinked } from "@/components/useAthlete";
import { niceDate } from "@/components/SessionHead";

export default function Zones() {
  const { athlete: a, err } = useAthlete();
  if (err) return <p className="err">{err}</p>;
  if (a === undefined) return <p className="note">Loading…</p>;
  if (!a) return <NotLinked />;
  return (
    <>
      <div><h1>Your zones</h1><div className="note">{a.test_date ? "From your lactate test on " + niceDate(a.test_date) : "Your coach will add these after your lactate test."}</div></div>
      {a.zones?.length > 0 && (
        <>
          <div className="tiles">
            <div className="tile"><span>LT1</span><b>{fmt(a.lt1)}/km</b><span style={{ letterSpacing: 0, textTransform: "none", fontWeight: 400 }}>Before lactate starts to rise</span></div>
            <div className="tile"><span>LT2</span><b>{fmt(a.lt2)}/km</b><span style={{ letterSpacing: 0, textTransform: "none", fontWeight: 400 }}>Where lactate starts to accumulate</span></div>
          </div>
          <div className="card" style={{ padding: 0 }}><div className="rtab-wrap"><table className="rtab">
            <thead><tr><th>ZONE</th><th>NAME</th><th>PACE /KM</th><th>HEART RATE</th></tr></thead>
            <tbody>{a.zones.map(z => (
              <tr key={z.code}><td><span className={"zchip z-" + z.code}>{z.code}</span></td><td>{ZNAME[z.code]}</td><td><b>{zRange(z)}</b></td><td>{z.hr ? z.hr + " bpm" : "–"}</td></tr>
            ))}</tbody>
          </table></div></div>
        </>
      )}
    </>
  );
}
