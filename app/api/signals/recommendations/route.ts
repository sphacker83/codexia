import {
  getSignalRecommendations,
  resolveSignalStyle,
} from "@/src/application/signals/signal-service";
import { isSignalDataUnavailableError } from "@/src/core/signals/errors";

export const runtime = "nodejs";

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.min(parsed, 10);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    const payload = await getSignalRecommendations(resolveSignalStyle(searchParams.get("style")), limit);
    return Response.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to load signal recommendations:", error);
    const status = isSignalDataUnavailableError(error) ? error.statusCode : 500;
    const message = isSignalDataUnavailableError(error) ? error.message : "추천 종목을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status });
  }
}
