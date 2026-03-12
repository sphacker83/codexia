import { getAgentJob } from "@/src/application/agent/job-service";
import { createAgentJobStreamResponse } from "@/src/presentation/server/agent-job-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;

function parseSince(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  if (!JOB_ID_PATTERN.test(jobId)) {
    return Response.json({ error: "jobId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const job = await getAgentJob(jobId);
  if (!job) {
    return Response.json({ error: "job을 찾을 수 없습니다." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const sinceEventId = parseSince(searchParams.get("since"));

  return createAgentJobStreamResponse({
    jobId,
    requestSignal: request.signal,
    sinceEventId,
  });
}
