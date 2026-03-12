import {
  cancelAllActiveJobs,
  listSessionsWithRecoveredActiveJobs,
} from "@/src/application/agent/job-service";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const sessions = await listSessionsWithRecoveredActiveJobs();
    return Response.json({ sessions }, { status: 200 });
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return Response.json({ error: "세션 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("action" in payload) ||
    payload.action !== "cancel-all-active-jobs"
  ) {
    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  }

  try {
    const result = await cancelAllActiveJobs();
    return Response.json(
      {
        ok: true,
        cancelledCount: result.cancelled.length,
        skippedCount: result.skipped.length,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to cancel active jobs:", error);
    return Response.json({ error: "활성 작업 종료에 실패했습니다." }, { status: 500 });
  }
}
