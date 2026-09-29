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

/**
 * One provider round trip reported by the Python pipeline. `stage` is the
 * progress stage that was running when the call started (null outside one).
 * `purpose` is null only for a call site that did not name itself.
 */
export type TargetingLlmCallEvent = {
  type: "llm_call";
  request_id: string;
  sequence: number;
  call_id: number;
  stage: TargetingProgressStage | null;
  purpose: string | null;
  label: string;
  model: string;
  /**
   * 이 호출에 **실제로 실린** 추론 깊이.
   *
   * `null` 은 모르는 값이 아니라 **깊이가 없는 호출**이다 — 추론 파라미터를 받지 않는
   * 모델에는 이 인자가 아예 가지 않는다. 옛 백엔드는 이 칸을 안 싣는데, 그때도 `null` 로
   * 읽는다(화면이 깊이를 안 보여 줄 뿐 줄 자체는 그대로 뜬다).
   */
  reasoning_effort: string | null;
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

export type TargetingTerminalEvent = TargetingResultEvent | TargetingErrorEvent;

export type TargetingStreamEvent =
  | TargetingProgressEvent
  | TargetingLlmCallEvent
  | TargetingTerminalEvent;

export function isTargetingTerminalEvent(
  event: TargetingStreamEvent,
): event is TargetingTerminalEvent {
  return event.type === "result" || event.type === "error";
}

export type TargetingProgressState = {
  requestId: string | null;
  lastSequence: number;
  stages: TargetingProgressEvent[];
  /** Latest event per LLM call, ordered by call_id. */
  llmCalls: TargetingLlmCallEvent[];
  terminal: TargetingTerminalEvent | null;
};

export const initialTargetingProgressState: TargetingProgressState = {
  requestId: null,
  lastSequence: -1,
  stages: [],
  llmCalls: [],
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
  if (event.type === "llm_call") {
    return (
      typeof event.call_id === "number" &&
      Number.isInteger(event.call_id) &&
      event.call_id >= 1 &&
      (event.stage === null ||
        (typeof event.stage === "string" &&
          TARGETING_PROGRESS_STAGE_SET.has(event.stage))) &&
      (event.purpose === null || typeof event.purpose === "string") &&
      typeof event.label === "string" &&
      typeof event.model === "string" &&
      // 옛 백엔드는 이 칸을 안 싣는다. 있으면 문자열이어야 하고, 없으면 그냥 없는 것이다 —
      // 여기서 막으면 깊이 하나 때문에 진행 줄이 통째로 사라진다.
      (event.reasoning_effort === null ||
        event.reasoning_effort === undefined ||
        typeof event.reasoning_effort === "string") &&
      typeof event.elapsed_ms === "number" &&
      Number.isFinite(event.elapsed_ms) &&
      event.elapsed_ms >= 0 &&
      (event.status === "started" ||
        event.status === "completed" ||
        event.status === "failed")
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
    this.terminalSeen = isTargetingTerminalEvent(value);
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
  if (isTargetingTerminalEvent(event)) return { ...base, terminal: event };
  if (event.type === "llm_call") {
    const llmCalls = state.llmCalls.filter(
      (item) => item.call_id !== event.call_id,
    );
    llmCalls.push(event);
    llmCalls.sort((left, right) => left.call_id - right.call_id);
    return { ...base, llmCalls };
  }
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
