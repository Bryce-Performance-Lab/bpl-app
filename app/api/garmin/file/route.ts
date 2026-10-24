import { NextResponse, type NextRequest } from "next/server";
import { allowed, garminGet } from "@/lib/garmin";
export const dynamic = "force-dynamic";

/** The original activity file (Garmin sends a .zip containing the .FIT). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams, id = q.get("id") || "";
  if (!(await allowed(q.get("athleteId")))) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const r = await garminGet(`/download-service/files/activity/${id}`);
  if (!r.ok) return NextResponse.json({ error: "garmin_" + r.status }, { status: 502 });
  return new NextResponse(await r.arrayBuffer(), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${id}.zip"` } });
}
