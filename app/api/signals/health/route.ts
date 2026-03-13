import { getSignalHealth } from "@/src/application/signals/signal-service";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const payload = await getSignalHealth();
    const status = payload.health.status === "failed" ? 503 : 200;
    return Response.json(payload, { status });
  } catch (error) {
    console.error("Failed to load signal health:", error);
    return Response.json({ error: "시그널 health를 불러오지 못했습니다." }, { status: 500 });
  }
}
