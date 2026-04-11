import { getAgentJob } from "@/src/application/agent/job-service";
import type { AgentJobEvent } from "@/src/core/agent/types";

export const runtime = "nodejs";

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
  const since = parseSince(searchParams.get("since"));
  const events: AgentJobEvent[] = since > 0 ? job.events.filter((event) => event.id > since) : job.events;

  return Response.json(
    {
      job: {
        jobId: job.jobId,
        sessionId: job.sessionId,
        status: job.status,
        trace: job.trace,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        updatedAt: job.updatedAt,
        assistantText: job.assistantText,
        promptMode: job.promptMode,
        error: job.error,
        usage: job.usage,
        contextMeta: job.contextMeta,
        lastEventId: job.lastEventId,
        events,
      },
    },
    { status: 200 },
  );
}
