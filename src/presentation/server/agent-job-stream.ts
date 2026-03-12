import { getAgentJob } from "@/src/application/agent/job-service";
import type {
  AgentJob,
  AgentJobEvent,
  AgentJobSnapshot,
  AgentJobStreamEvent,
} from "@/src/core/agent/types";

const encoder = new TextEncoder();
const STREAM_POLL_INTERVAL_MS = 250;

export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

export function toAgentJobSnapshot(job: AgentJob): AgentJobSnapshot {
  return {
    jobId: job.jobId,
    sessionId: job.sessionId,
    status: job.status,
    trace: job.trace,
    ownerId: job.ownerId,
    heartbeatAt: job.heartbeatAt,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
    assistantText: job.assistantText,
    error: job.error,
    usage: job.usage,
    contextMeta: job.contextMeta,
    lastEventId: job.lastEventId,
  };
}

export function serializeAgentJobStreamEvent(event: AgentJobStreamEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      resolve();
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function getPendingEvents(events: AgentJobEvent[], sinceEventId: number): AgentJobEvent[] {
  if (sinceEventId <= 0) {
    return events;
  }
  return events.filter((event) => event.id > sinceEventId);
}

interface CreateAgentJobStreamOptions {
  jobId: string;
  requestSignal?: AbortSignal;
  initialEvents?: AgentJobStreamEvent[];
  sinceEventId?: number;
}

export function createAgentJobStreamResponse({
  jobId,
  requestSignal,
  initialEvents = [],
  sinceEventId = 0,
}: CreateAgentJobStreamOptions): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastSentEventId = Math.max(0, sinceEventId);
      let hasSentSnapshot = false;
      let lastAssistantText = "";
      let lastStatus: AgentJob["status"] | null = null;
      let lastUpdatedAt = "";

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        controller.close();
      };

      const enqueue = (event: AgentJobStreamEvent) => {
        if (closed) {
          return;
        }
        controller.enqueue(serializeAgentJobStreamEvent(event));
      };

      const onAbort = () => {
        close();
      };

      requestSignal?.addEventListener("abort", onAbort, { once: true });

      try {
        for (const event of initialEvents) {
          enqueue(event);
        }

        while (!closed) {
          const job = await getAgentJob(jobId);
          if (!job) {
            enqueue({
              type: "error",
              jobId,
              message: "작업 정보를 찾을 수 없습니다.",
            });
            break;
          }

          const pendingEvents = getPendingEvents(job.events, lastSentEventId);
          const shouldSendSnapshot =
            !hasSentSnapshot ||
            (pendingEvents.length === 0 &&
              (job.assistantText !== lastAssistantText ||
                job.status !== lastStatus ||
                job.updatedAt !== lastUpdatedAt));

          if (shouldSendSnapshot) {
            enqueue({
              type: "snapshot",
              job: toAgentJobSnapshot(job),
              events: pendingEvents,
            });
            hasSentSnapshot = true;
          } else {
            for (const event of pendingEvents) {
              enqueue({
                type: "event",
                jobId,
                event,
              });
            }
          }

          lastSentEventId = job.lastEventId;
          lastAssistantText = job.assistantText;
          lastStatus = job.status;
          lastUpdatedAt = job.updatedAt;

          if (job.status === "completed" || job.status === "failed") {
            enqueue({
              type: "done",
              job: toAgentJobSnapshot(job),
            });
            break;
          }

          await sleep(STREAM_POLL_INTERVAL_MS, requestSignal);
        }
      } catch (error) {
        if (!closed && !requestSignal?.aborted) {
          enqueue({
            type: "error",
            jobId,
            message: error instanceof Error ? error.message : "스트림 생성 중 오류가 발생했습니다.",
          });
        }
      } finally {
        requestSignal?.removeEventListener("abort", onAbort);
        close();
      }
    },
    cancel() {
      // no-op
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
