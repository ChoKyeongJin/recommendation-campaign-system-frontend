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

/**
 * 이 요청이 provider 에 낸 요금과 **캐시가 산 몫**. 요청 끝에 한 번, terminal 앞에 온다.
 *
 * 합계는 백엔드가 낸다 — 화면이 호출별 사용량을 직접 합산하면 「미측정을 0 으로 세지
 * 않는다」 같은 규약이 화면 코드에 살고, 그 규약은 거기서 조용히 갈린다.
 */
export type TargetingLlmAccountingCache = {
  /** 캐시를 **보고한** 호출 수. 나머지는 적중률의 분모에서 빠진다. */
  reported_calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  uncached_input_tokens: number;
  /** 총합의 비(요청별 비율의 평균이 아니다). 잰 것이 없으면 `null` 이고 0 이 아니다. */
  hit_ratio: number | null;
};

export type TargetingLlmAccountingCost = {
  /** `priced` · `partial` · `undeclared`. 모르는 값은 금액 없음으로 읽는다. */
  status: string;
  priced_calls: number;
  unpriced_models: string[];
  /** 읽을 수 없던 단가 선언. 「선언이 없다」와 「깨져 있다」는 할 일이 다르다. */
  rejected_declarations: string[];
  /** 합계가 요청의 **전부**를 덮는가. 아니면 총액이 아니라 바닥값이다. */
  complete: boolean;
  usd?: number;
  /** 같은 요청을 캐시 없이 냈다면 얼마였는가 — 절감률의 분모다. */
  without_cache_usd?: number;
  saved_usd?: number;
  saved_ratio?: number | null;
};

export type TargetingLlmAccountingByModel = {
  model: string;
  calls: number;
  unmeasured_calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
};

export type TargetingLlmAccountingEvent = {
  type: "llm_accounting";
  request_id: string;
  sequence: number;
  calls: number;
  measured_calls: number;
  /** 사용량이 관측되지 않은 호출. **0 토큰 호출이 아니다.** */
  unmeasured_calls: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number | null;
  cache: TargetingLlmAccountingCache;
  cost: TargetingLlmAccountingCost;
  by_model: TargetingLlmAccountingByModel[];
};

/**
 * 이 화면이 아직 모르는 사건. 봉투(type·request_id·sequence)만 성립하면 **순번을 전진시키고
 * 그대로 흘린다.**
 *
 * 닫힌 목록으로 거절하면 백엔드가 사건을 하나 더하는 순간 화면이 그 요청을 통째로 잃는다 —
 * 순번 검사가 이어지므로 버린 사건 **뒤의 terminal 까지** 어긋나 스트림이 끊긴다. 실제로 그렇게
 * 났다: `llm_accounting` 이 추가됐을 때 화면은 `upstream_stream_contract_invalid` 로 닫혔다.
 */
export type TargetingUnknownEvent = {
  type: string;
  request_id: string;
  sequence: number;
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
  | TargetingLlmAccountingEvent
  | TargetingTerminalEvent;

/** 이 화면이 **모양을 아는** 사건 종류. 나머지는 봉투만 보고 흘린다. */
const KNOWN_TARGETING_EVENT_TYPES = new Set<string>([
  "progress",
  "llm_call",
  "llm_accounting",
  "result",
  "error",
]);

export type TargetingForwardableEvent =
  | TargetingStreamEvent
  | TargetingUnknownEvent;

export function isTargetingTerminalEvent(
  event: TargetingForwardableEvent,
): event is TargetingTerminalEvent {
  return event.type === "result" || event.type === "error";
}

export function isTargetingResultEvent(
  event: TargetingForwardableEvent,
): event is TargetingResultEvent {
  return event.type === "result";
}

export function isTargetingErrorEvent(
  event: TargetingForwardableEvent,
): event is TargetingErrorEvent {
  return event.type === "error";
}

export function isTargetingLlmCallEvent(
  event: TargetingForwardableEvent,
): event is TargetingLlmCallEvent {
  return event.type === "llm_call";
}

export function isTargetingLlmAccountingEvent(
  event: TargetingForwardableEvent,
): event is TargetingLlmAccountingEvent {
  return event.type === "llm_accounting";
}

export function isTargetingProgressEvent(
  event: TargetingForwardableEvent,
): event is TargetingProgressEvent {
  return event.type === "progress";
}

export type TargetingProgressState = {
  requestId: string | null;
  lastSequence: number;
  stages: TargetingProgressEvent[];
  /** Latest event per LLM call, ordered by call_id. */
  llmCalls: TargetingLlmCallEvent[];
  /** 이 요청의 요금·캐시 회계. 요청 끝에 한 번 오므로 그때까지 `null` 이다. */
  accounting: TargetingLlmAccountingEvent | null;
  terminal: TargetingTerminalEvent | null;
};

export const initialTargetingProgressState: TargetingProgressState = {
  requestId: null,
  lastSequence: -1,
  stages: [],
  llmCalls: [],
  accounting: null,
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

function isWholeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 봉투만 성립하는가 — 종류를 모르더라도 순번은 이어 세야 한다. */
function isTargetingEnvelope(value: unknown): value is TargetingUnknownEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.type === "string" &&
    typeof event.request_id === "string" &&
    typeof event.sequence === "number" &&
    Number.isInteger(event.sequence) &&
    event.sequence >= 1
  );
}

/**
 * 흘려도 되는 사건으로 판정한다.
 *
 * 모양을 아는 종류는 **그 모양대로** 검사하고(틀리면 거절), 모르는 종류는 봉투만 보고 통과시킨다.
 * 「모르는 종류」와 「아는 종류인데 모양이 틀림」은 다른 사실이다 — 뒤쪽은 백엔드 결함이므로
 * 여전히 거절해야 하고, 앞쪽은 단지 이 화면이 아직 안 그리는 것이다.
 */
export function asForwardableTargetingEvent(
  value: unknown,
): TargetingForwardableEvent | null {
  if (!isTargetingEnvelope(value)) return null;
  if (!KNOWN_TARGETING_EVENT_TYPES.has(value.type)) return value;
  return isTargetingStreamEvent(value) ? value : null;
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
  if (event.type === "llm_accounting") {
    // 화면이 **읽는** 칸만 본다. 열거형(`cost.status`)은 문자열로만 재고 모르는 값은 렌더에서
    // 금액 없음으로 닫는다 — 값 하나가 늘어날 때마다 요청을 잃지 않기 위해서다.
    const cache = event.cache as Record<string, unknown> | undefined;
    const cost = event.cost as Record<string, unknown> | undefined;
    if (!cache || typeof cache !== "object" || !cost || typeof cost !== "object") {
      return false;
    }
    return (
      isWholeNumber(event.calls) &&
      isWholeNumber(event.measured_calls) &&
      isWholeNumber(event.unmeasured_calls) &&
      isWholeNumber(event.input_tokens) &&
      isWholeNumber(event.output_tokens) &&
      (event.reasoning_tokens === null ||
        isWholeNumber(event.reasoning_tokens)) &&
      isWholeNumber(cache.reported_calls) &&
      isWholeNumber(cache.input_tokens) &&
      isWholeNumber(cache.cached_input_tokens) &&
      isWholeNumber(cache.uncached_input_tokens) &&
      (cache.hit_ratio === null || typeof cache.hit_ratio === "number") &&
      typeof cost.status === "string" &&
      typeof cost.complete === "boolean" &&
      Array.isArray(cost.unpriced_models) &&
      Array.isArray(event.by_model)
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

  accept(value: unknown): TargetingForwardableEvent | null {
    const event = asForwardableTargetingEvent(value);
    if (event === null) return null;
    if (
      this.terminalSeen ||
      (this.currentRequestId !== null &&
        event.request_id !== this.currentRequestId) ||
      event.sequence !== this.currentSequence + 1
    ) {
      return null;
    }
    this.currentRequestId = event.request_id;
    this.currentSequence = event.sequence;
    this.terminalSeen = isTargetingTerminalEvent(event);
    return event;
  }
}

export function reduceTargetingProgress(
  state: TargetingProgressState,
  event: TargetingForwardableEvent,
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
  if (isTargetingLlmAccountingEvent(event)) {
    return { ...base, accounting: event };
  }
  if (isTargetingLlmCallEvent(event)) {
    const call = event;
    const llmCalls = state.llmCalls.filter(
      (item) => item.call_id !== call.call_id,
    );
    llmCalls.push(call);
    llmCalls.sort((left, right) => left.call_id - right.call_id);
    return { ...base, llmCalls };
  }
  // 모르는 종류는 순번만 전진시킨다 — 그리지 않을 뿐 스트림을 끊지 않는다.
  if (!isTargetingProgressEvent(event)) return base;
  const stage = event;
  const stages = state.stages.filter((item) => item.stage !== stage.stage);
  stages.push(stage);
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


/** 화면에 적을 회계 한 줄. 세 칸으로 나눠 두 지표가 한 칸에 섞이지 않게 한다. */
export type TargetingAccountingSummary = {
  /** 캐시가 얼마나 탔는가(입력 토큰). 잰 것이 없으면 `null`. */
  cache: string | null;
  /** 이 요청의 요금. 단가 선언이 없으면 `null` — 0 원이 아니다. */
  cost: string | null;
  /** 요금이 얼마나 덜 나갔는가. 적중이 없거나 단가가 없으면 `null`. */
  saved: string | null;
  /** 합계가 요청의 전부를 덮지 못한 이유. 없으면 `null`. */
  caveat: string | null;
};

function formatWhole(value: number): string {
  return value.toLocaleString("ko-KR");
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatUsd(value: number): string {
  // 이 봉투의 호출당 요금은 센트 아래에서 갈리므로 소수 네 자리까지 적는다.
  return `$${value.toFixed(4)}`;
}

/**
 * 회계 사건을 화면 문구로 옮긴다.
 *
 * 세 가지를 지킨다 — 이 셋이 화면에서 무너지면 숫자가 거짓말을 한다.
 *
 * 1. **적중률과 절감률을 한 칸에 적지 않는다.** 캐시된 입력은 정가가 아니라 캐시 단가로
 *    청구되고 출력은 캐시와 무관하게 정가이므로, 절감률은 언제나 적중률보다 작다. 토큰 비를
 *    절감률 칸에 적으면 절감을 과장한다.
 * 2. **단가 선언이 없으면 금액 칸을 비운다.** 0 원이 아니라 **모른다**.
 * 3. **합계가 전부를 덮지 못하면 그렇게 적는다.** 미측정 호출이나 단가 없는 모델이 있으면
 *    그 합계는 총액이 아니라 바닥값이다.
 */
export function describeTargetingAccounting(
  event: TargetingLlmAccountingEvent,
): TargetingAccountingSummary {
  const { cache, cost } = event;
  const priced = typeof cost.usd === "number";
  const floor = !cost.complete;

  const cacheText =
    cache.hit_ratio === null
      ? null
      : `캐시 ${formatWhole(cache.cached_input_tokens)}/${formatWhole(
          cache.input_tokens,
        )} 토큰 (${formatPercent(cache.hit_ratio)})`;

  const costText = priced
    ? `${floor ? "최소 " : ""}${formatUsd(cost.usd as number)}`
    : null;

  const savedRatio = cost.saved_ratio;
  const savedText =
    priced &&
    typeof cost.saved_usd === "number" &&
    cost.saved_usd > 0 &&
    typeof savedRatio === "number"
      ? `요금 ${formatPercent(savedRatio)} 절감 (캐시 없이 ${formatUsd(
          cost.without_cache_usd as number,
        )})`
      : null;

  const reasons: string[] = [];
  if (event.unmeasured_calls > 0) {
    reasons.push(`사용량 미측정 ${event.unmeasured_calls}회`);
  }
  if (cost.unpriced_models.length > 0) {
    reasons.push(`단가 미선언 ${cost.unpriced_models.join(", ")}`);
  }
  if (!priced) reasons.push("단가 선언 없음");
  if (cost.rejected_declarations.length > 0) {
    reasons.push(`읽을 수 없는 단가 선언 ${cost.rejected_declarations.length}건`);
  }

  return {
    cache: cacheText,
    cost: costText,
    saved: savedText,
    caveat: reasons.length > 0 ? reasons.join(" · ") : null,
  };
}
