export type TargetingProgressStatus = "started" | "completed" | "failed";

export const TARGETING_PROGRESS_STAGES = [
  "request_analysis",
  "semantic_resolution",
  "knowledge_retrieval",
  "sql_compilation",
  "database_execution",
  "audience_materialization",
] as const;

export type TargetingProgressStage =
  (typeof TARGETING_PROGRESS_STAGES)[number];

const TARGETING_PROGRESS_STAGE_SET = new Set<string>(
  TARGETING_PROGRESS_STAGES,
);

export type TargetingProgressEvent = {
  type: "progress";
  request_id: string;
  sequence: number;
  stage: TargetingProgressStage;
  order: number;
  total: number;
  label: string;
  description: string;
  status: TargetingProgressStatus;
  elapsed_ms: number;
};

export type TargetingResultEvent = {
  type: "result";
  request_id: string;
  sequence: number;
  data: unknown;
};

export type TargetingErrorEvent = {
  type: "error";
  request_id: string;
  sequence: number;
  error: { status: number; code: string; message: string };
};

export type TargetingStreamEvent =
  | TargetingProgressEvent
  | TargetingResultEvent
  | TargetingErrorEvent;

export type TargetingProgressState = {
  requestId: string | null;
  lastSequence: number;
  stages: TargetingProgressEvent[];
  terminal: TargetingResultEvent | TargetingErrorEvent | null;
};

export const initialTargetingProgressState: TargetingProgressState = {
  requestId: null,
  lastSequence: -1,
  stages: [],
  terminal: null,
};

export type TargetingResponseTransport = "ndjson" | "json" | "unsupported";

export function getTargetingResponseTransport(
  contentType: string | null,
): TargetingResponseTransport {
  const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (mediaType === "application/x-ndjson") return "ndjson";
  if (mediaType === "application/json") return "json";
  return "unsupported";
}

export function isTargetingStreamEvent(
  value: unknown,
): value is TargetingStreamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (
    typeof event.request_id !== "string" ||
    typeof event.sequence !== "number" ||
    !Number.isInteger(event.sequence) ||
    event.sequence < 1
  ) return false;
  if (event.type === "result") {
    return (
      "data" in event &&
      event.data !== null &&
      typeof event.data === "object" &&
      !Array.isArray(event.data)
    );
  }
  if (event.type === "error") {
    if (!event.error || typeof event.error !== "object") return false;
    const error = event.error as Record<string, unknown>;
    return (
      typeof error.status === "number" &&
      Number.isInteger(error.status) &&
      typeof error.code === "string" &&
      typeof error.message === "string"
    );
  }
  const stageIndex =
    typeof event.stage === "string"
      ? TARGETING_PROGRESS_STAGES.indexOf(
          event.stage as TargetingProgressStage,
        )
      : -1;
  return (
    event.type === "progress" &&
    typeof event.stage === "string" &&
    TARGETING_PROGRESS_STAGE_SET.has(event.stage) &&
    typeof event.order === "number" &&
    Number.isInteger(event.order) &&
    event.order === stageIndex + 1 &&
    typeof event.total === "number" &&
    Number.isInteger(event.total) &&
    event.total === TARGETING_PROGRESS_STAGES.length &&
    typeof event.label === "string" &&
    typeof event.description === "string" &&
    typeof event.elapsed_ms === "number" &&
    Number.isFinite(event.elapsed_ms) &&
    event.elapsed_ms >= 0 &&
    (event.status === "started" ||
      event.status === "completed" ||
      event.status === "failed")
  );
}

export class TargetingStreamContract {
  private currentRequestId: string | null = null;
  private currentSequence = 0;
  private terminalSeen = false;

  get requestId(): string | null {
    return this.currentRequestId;
  }

  get nextSequence(): number {
    return this.currentSequence + 1;
  }

  get hasTerminal(): boolean {
    return this.terminalSeen;
  }

  accept(value: unknown): TargetingStreamEvent | null {
    if (!isTargetingStreamEvent(value)) return null;
    if (
      this.terminalSeen ||
      (this.currentRequestId !== null &&
        value.request_id !== this.currentRequestId) ||
      value.sequence !== this.currentSequence + 1
    ) {
      return null;
    }
    this.currentRequestId = value.request_id;
    this.currentSequence = value.sequence;
    this.terminalSeen = value.type !== "progress";
    return value;
  }
}

export function reduceTargetingProgress(
  state: TargetingProgressState,
  event: TargetingStreamEvent,
): TargetingProgressState {
  if (state.terminal || event.sequence <= state.lastSequence) return state;
  if (state.requestId !== null && event.request_id !== state.requestId) {
    return state;
  }
  const base = {
    ...state,
    requestId: event.request_id,
    lastSequence: event.sequence,
  };
  if (event.type !== "progress") return { ...base, terminal: event };
  const stages = state.stages.filter((item) => item.stage !== event.stage);
  stages.push(event);
  stages.sort((left, right) => left.order - right.order);
  return { ...base, stages };
}

export class NdjsonParser {
  private buffer = "";

  push(chunk: string): unknown[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    return lines.flatMap((line) => {
      const trimmed = line.trim();
      return trimmed ? [JSON.parse(trimmed)] : [];
    });
  }

  finish(): unknown[] {
    const trailing = this.buffer.trim();
    this.buffer = "";
    return trailing ? [JSON.parse(trailing)] : [];
  }
}
