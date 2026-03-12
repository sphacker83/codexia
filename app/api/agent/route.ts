import { createAgentJob, isActiveJobError } from "@/src/application/agent/job-service";
import {
  createAgentErrorResponse,
  validateAgentRequest,
} from "@/src/presentation/server/agent-request-validator";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return createAgentErrorResponse("Invalid JSON body.", 400);
  }

  const validation = validateAgentRequest(payload);
  if (!validation.ok) {
    return createAgentErrorResponse(validation.reason, validation.status);
  }

  try {
    const job = await createAgentJob({
      sessionId: validation.data.sessionId,
      message: validation.data.message,
      model: validation.data.model,
      reasoningEffort: validation.data.reasoningEffort,
      trace: validation.data.trace === true,
      source: "web",
    });

    return Response.json(
      {
        job: {
          jobId: job.jobId,
          sessionId: job.sessionId,
          status: job.status,
          trace: job.trace,
          createdAt: job.createdAt,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    if (isActiveJobError(error)) {
      return Response.json(
        {
          error: "이미 실행 중인 작업이 있습니다.",
          activeJobId: error.activeJobId,
        },
        { status: 409 },
      );
    }

    console.error("Failed to create agent job:", error);
    return createAgentErrorResponse("Internal server error.", 500);
  }
}
