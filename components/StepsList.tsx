import { amt, stepTarget, zone, zRangeShort } from "@/lib/engine.js";
import type { Athlete, Step } from "@/lib/data";

/** The planned steps with zone colour and the athlete's target for each. */
export default function StepsList({ steps, athlete }: { steps: Step[]; athlete: Athlete }) {
  if (!steps?.length) return <p className="note" style={{ margin: 0 }}>Rest day.</p>;
  return (
    <div className="rtab-wrap">
      <table className="rtab">
        <tbody>
          {steps.map((s, i) => {
            const reps = +s.reps || 1;
            return (
              <tr key={i}>
                <td style={{ width: 40 }}><span className={"zchip z-" + s.zone}>{s.zone}</span></td>
                <td>
                  <b>{s.label || (reps > 1 ? "Reps" : "Run")}</b> <span>{(reps > 1 ? reps + " × " : "") + amt(s.amount, s.unit)}</span>
                  {reps > 1 && +s.recAmount ? <div className="note">{amt(s.recAmount, s.recUnit)} recovery in {s.recZone} ({zRangeShort(zone(athlete, s.recZone))}/km)</div> : null}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{stepTarget(athlete, s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
