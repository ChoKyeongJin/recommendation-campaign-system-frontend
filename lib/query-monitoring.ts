export type FailureRecord = {
  failure_log_id: number;
  prompt: string;
  api_status: string | null;
  failure_stage: string;
  failure_reason: string;
  called_at: string | null;
  recorded_at: string;
  summary: string | null;
  message: string | null;
  diagnosis_stage: string | null;
  diagnosis_code: string | null;
};

export type FailurePage = { items: FailureRecord[]; total: number; page: number; page_size: number };
export type FailureFilters = { q: string; stage: string; since: string; until: string };
export const emptyFilters: FailureFilters = { q: "", stage: "", since: "", until: "" };
export const failureStages: Record<string, string> = {
  sql_generation: "SQL 생성", database_execution: "DB 실행", startup: "서비스 준비", retrieval: "요청 처리",
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

function record(value: unknown): value is FailureRecord {
  return object(value) && typeof value.failure_log_id === "number" && Number.isSafeInteger(value.failure_log_id)
    && value.failure_log_id > 0
    && ["prompt", "failure_stage", "failure_reason"].every((key) => typeof value[key] === "string")
    && ["api_status", "summary", "message", "diagnosis_stage", "diagnosis_code"].every(
      (key) => value[key] === null || typeof value[key] === "string")
    && timestamp(value.recorded_at) && (value.called_at === null || timestamp(value.called_at));
}

export function parseFailurePage(value: unknown): FailurePage | null {
  if (!object(value) || !Array.isArray(value.items) || !value.items.every(record)
    || typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0
    || typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1
    || typeof value.page_size !== "number" || !Number.isSafeInteger(value.page_size) || value.page_size < 1
    || value.page_size > 100 || value.items.length > value.page_size || value.items.length > value.total) return null;
  return { items: value.items, total: value.total, page: value.page, page_size: value.page_size };
}

export function failureQuery(filters: FailureFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  for (const key of ["q", "stage", "since", "until"] as const) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function failureTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

export function failureSummary(item: FailureRecord): string {
  return item.summary?.trim() || item.message?.trim() || item.failure_reason;
}

export function failureReadError(value: unknown): string {
  return object(value) && typeof value.detail === "string"
    ? value.detail : "실패 기록을 불러오지 못했습니다. 검색 조건을 확인하고 다시 시도해 주세요.";
}
