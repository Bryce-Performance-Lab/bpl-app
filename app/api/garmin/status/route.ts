import { NextResponse, type NextRequest } from "next/server";
import { allowed } from "@/lib/garmin";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  return NextResponse.json({ enabled: await allowed(req.nextUrl.searchParams.get("athleteId")) });
}
