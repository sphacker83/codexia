import { loadExistingSessionWithRecoveredActiveJob } from "@/src/application/agent/job-service";
import { deleteSession } from "@/src/infrastructure/agent/session-file-store";

export const runtime = "nodejs";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;

function validateSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  if (!validateSessionId(sessionId)) {
    return Response.json({ error: "sessionId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const session = await loadExistingSessionWithRecoveredActiveJob(sessionId);
  if (!session) {
    return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  return Response.json({ session }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  if (!validateSessionId(sessionId)) {
    return Response.json({ error: "sessionId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const deleted = await deleteSession(sessionId);
    if (!deleted) {
      return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return Response.json({ error: "세션 삭제에 실패했습니다." }, { status: 500 });
  }
}
