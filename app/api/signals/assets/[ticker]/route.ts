import { getSignalAssetDetail, resolveSignalStyle } from "@/src/application/signals/signal-service";

export const runtime = "nodejs";

const TICKER_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const { ticker } = await context.params;
  if (!TICKER_PATTERN.test(ticker)) {
    return Response.json({ error: "ticker 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const payload = await getSignalAssetDetail(resolveSignalStyle(searchParams.get("style")), ticker);
    if (!payload) {
      return Response.json({ error: "자산을 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to load signal asset detail:", error);
    return Response.json({ error: "자산 상세를 불러오지 못했습니다." }, { status: 500 });
  }
}
