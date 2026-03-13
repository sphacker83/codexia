import { getSignalHealth } from "@/src/application/signals/signal-service";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const payload = await getSignalHealth();
    return Response.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to load signal health:", error);
    return Response.json({ error: "시그널 health를 불러오지 못했습니다." }, { status: 500 });
  }
}
