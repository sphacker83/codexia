import { cancelAllActiveJobs } from "@/src/application/agent/job-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const result = await cancelAllActiveJobs();
    return Response.json(
      {
        ok: true,
        cancelledCount: result.cancelled.length,
        cancelled: result.cancelled,
        skipped: result.skipped,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to cancel all active jobs:", error);
    return Response.json({ error: "활성 작업 일괄 취소에 실패했습니다." }, { status: 500 });
  }
}
