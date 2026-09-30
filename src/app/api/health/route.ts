import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public, data-free endpoint used by the keep-alive ping (and by uptime monitors). */
export function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
