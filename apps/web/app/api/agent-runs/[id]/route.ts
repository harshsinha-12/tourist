import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  const viewerToken = process.env.TOURIST_WEB_VIEW_TOKEN;
  const supplied = request.headers.get("x-view-token") ?? "";
  if (!viewerToken || !supplied || !timingSafeEqual(createHash("sha256").update(viewerToken).digest(), createHash("sha256").update(supplied).digest())) {
    return NextResponse.json({ error: "Viewer token required" }, { status: 401 });
  }
  const base = process.env.TOURIST_CLOUD_URL;
  const apiToken = process.env.TOURIST_CLOUD_TOKEN;
  if (!base || !apiToken) return NextResponse.json({ error: "Cloud run viewer is not configured" }, { status: 503 });
  try {
    const upstream = await fetch(new URL(`/v1/runs/${id}/events`, base), { headers: { authorization: `Bearer ${apiToken}` }, cache: "no-store" });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Cloud API is unavailable" }, { status: 502 });
  }
}
