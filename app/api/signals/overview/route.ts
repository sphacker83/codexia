import { getSignalOverview, resolveSignalStyle } from "@/src/application/signals/signal-service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const overview = await getSignalOverview(resolveSignalStyle(searchParams.get("style")));
    return Response.json(overview, { status: 200 });
  } catch (error) {
    console.error("Failed to load signal overview:", error);
    return Response.json({ error: "시그널 overview를 불러오지 못했습니다." }, { status: 500 });
  }
}
