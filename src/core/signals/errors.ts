import type {
  SignalHealthResponse,
  SignalHealthSource,
} from "@/src/core/signals/types";

const SIGNAL_UNAVAILABLE_DISCLAIMER =
  "이 기능은 자동매매가 아닌 판단 보조용입니다. live snapshot이 준비되기 전에는 응답이 제한될 수 있습니다.";

export class SignalDataUnavailableError extends Error {
  readonly code = "SIGNAL_DATA_UNAVAILABLE";
  readonly statusCode = 503;
  readonly sources: SignalHealthSource[];

  constructor(message: string, sources?: SignalHealthSource[]) {
    super(message);
    this.name = "SignalDataUnavailableError";
    this.sources = sources ?? [
      {
        key: "postgres",
        label: "PostgreSQL",
        status: "failed",
        updatedAt: "",
        detail: "required live signal snapshot을 찾지 못했습니다.",
      },
    ];
  }

  toHealthResponse(): SignalHealthResponse {
    return {
      dataMode: "live",
      snapshotMode: "live",
      demo: false,
      generatedAt: new Date().toISOString(),
      stale: false,
      health: {
        status: "failed",
        summary: this.message,
        sources: this.sources,
      },
      disclaimer: SIGNAL_UNAVAILABLE_DISCLAIMER,
    };
  }
}

export function isSignalDataUnavailableError(error: unknown): error is SignalDataUnavailableError {
  return error instanceof SignalDataUnavailableError;
}
