import { NextResponse, type NextRequest } from "next/server";
import { allowed, garminGet } from "@/lib/garmin";
export const dynamic = "force-dynamic";

/** Activities from the day before to the day after a date. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams, date = q.get("date") || "";
  if (!(await allowed(q.get("athleteId")))) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad_date" }, { status: 400 });
  const d = new Date(date + "T00:00:00Z"), day = (n: number) => new Date(d.getTime() + n * 864e5).toISOString().slice(0, 10);
  try {
    const r = await garminGet(`/activitylist-service/activities/search/activities?startDate=${day(-1)}&endDate=${day(1)}&limit=30&sortOrder=asc`);
    if (!r.ok) return NextResponse.json({ error: "garmin_" + r.status }, { status: 502 });
    const list = (await r.json()) as any[];
    return NextResponse.json(list.map(a => ({
      id: String(a.activityId), name: a.activityName, start: a.startTimeLocal, type: a.activityType?.typeKey || "",
      km: a.distance != null ? +(a.distance / 1000).toFixed(2) : null, sec: a.duration != null ? Math.round(a.duration) : null, hr: a.averageHR ?? null,
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message === "not_configured" ? "not_configured" : "garmin_unavailable" }, { status: 502 });
  }
}
