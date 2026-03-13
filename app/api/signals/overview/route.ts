import { getSignalOverview, resolveSignalStyle } from "@/src/application/signals/signal-service";
import { isSignalDataUnavailableError } from "@/src/core/signals/errors";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const overview = await getSignalOverview(resolveSignalStyle(searchParams.get("style")));
    return Response.json(overview, { status: 200 });
  } catch (error) {
    console.error("Failed to load signal overview:", error);
    const status = isSignalDataUnavailableError(error) ? error.statusCode : 500;
    const message = isSignalDataUnavailableError(error) ? error.message : "시그널 overview를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status });
  }
}
