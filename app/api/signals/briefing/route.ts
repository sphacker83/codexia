import { getSignalBriefing, resolveSignalStyle } from "@/src/application/signals/signal-service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const briefing = await getSignalBriefing(resolveSignalStyle(searchParams.get("style")));
    return Response.json(briefing, { status: 200 });
  } catch (error) {
    console.error("Failed to load signal briefing:", error);
    return Response.json({ error: "브리핑을 불러오지 못했습니다." }, { status: 500 });
  }
}
