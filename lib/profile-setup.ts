export type ValueRow = { canonical: string; physical: string | number | boolean | null; label: string; description: string };
export type ProfileField = {
  source: string; column: string; data_type: string; label?: string;
  allowed_operators?: string[]; unit?: string; value_domain?: string;
  expression?: string; semantic_visibility?: string; _onboarding_gaps?: Record<string, unknown>;
};
export type Coverage = { expressible?: boolean; reason?: string; fields?: string[]; sources?: string[]; negated_sources?: string[] };
export type SetupSnapshot = {
  apply?: { available: boolean; job: ApplyJob | null };
  profile: string; revision: string; restart_required: boolean;
  subject: { name?: string; table: string; key: string; label?: string };
  fields: Record<string, ProfileField>;
  domains: Record<string, { label: string; editable: boolean; values: ValueRow[] }>;
  sources: Record<string, { label: string; table: string }>;
  families: string[]; coverage: Record<string, Coverage>;
  basics: { base_entity: { age_column: string }; active_state: { column?: string; value?: ValueRow["physical"]; _supported?: boolean } };
  files: string[];
};

export type ApplyJob = {
  id: string; revision: string;
  status: "queued" | "indexing" | "restarting" | "ready" | "failed";
  code: string;
};
export const applyingSettings = (job: ApplyJob | null | undefined) =>
  !!job && ["queued", "indexing", "restarting"].includes(job.status);
export function applyMessage(job: ApplyJob): string {
  if (job.status === "queued") return "설정 적용을 준비하고 있습니다.";
  if (job.status === "indexing") return "검색 인덱스를 갱신하고 있습니다. 잠시 기다려 주세요.";
  if (job.status === "restarting") return "API를 재시작하고 정상 동작을 확인하고 있습니다.";
  if (job.status === "ready") return "인덱스 갱신과 API 재시작을 완료했습니다. 저장한 설정이 적용되었습니다.";
  const failures: Record<string, string> = {
    index_failed: "검색 인덱스 갱신에 실패했습니다. API를 재시작하지 않았습니다. 다시 적용해 주세요.",
    index_timeout: "검색 인덱스 갱신 시간이 초과되었습니다. 다시 적용해 주세요.",
    revision_conflict: "적용 중 설정이 변경되었습니다. 새로 불러온 뒤 다시 적용해 주세요.",
    restart_failed: "API의 정상 동작을 확인하지 못했습니다. 서버 상태를 확인해 주세요.",
    apply_interrupted: "설정 적용 도중 서버가 종료되었습니다. 다시 적용해 주세요.",
  };
  return failures[job.code] ?? "설정 적용에 실패했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.";
}
export type FieldChange = {
  id: string; label: string; allowed_operators: string[];
  unit: string | null; value_domain: string | null; enable_draft: boolean;
};
export type CoverageChange = {
  family: string; mode: "supported" | "unsupported"; reason: string;
  fields: string[]; sources: string[]; negated_sources: string[];
};
export type SetupChanges = {
  fields: FieldChange[];
  domains: { id: string; values: ValueRow[]; field_id?: string }[];
  coverage: CoverageChange[];
  basics?: { age_column: string; active_column: string; active_value: ValueRow["physical"] };
};

export const emptyChanges = (): SetupChanges => ({ fields: [], domains: [], coverage: [] });
export function replaceChange<T>(items: T[], updated: T, same: (item: T) => boolean): T[] {
  return [...items.filter((item) => !same(item)), updated];
}
export const editCount = (changes: SetupChanges) => changes.fields.length + changes.domains.length + changes.coverage.length + (changes.basics ? 1 : 0);
export function fieldChange(id: string, field: ProfileField): FieldChange {
  return { id, label: field.label ?? "", allowed_operators: field.allowed_operators ?? [],
    unit: field.unit ?? null, value_domain: field.value_domain ?? null, enable_draft: false };
}
export function coverageChange(family: string, coverage?: Coverage): CoverageChange {
  return { family, mode: coverage?.expressible === false ? "unsupported" : "supported", reason: coverage?.reason ?? "",
    fields: coverage?.fields ?? [], sources: coverage?.sources ?? [], negated_sources: coverage?.negated_sources ?? [] };
}
export function switchCoverageMode(change: CoverageChange, mode: CoverageChange["mode"]): CoverageChange {
  return mode === "unsupported" ? { ...change, mode, fields: [], sources: [], negated_sources: [] }
    : { ...change, mode, reason: "" };
}
export function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return "요청을 처리하지 못했습니다.";
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((error) => `${error.loc?.slice(1).join(".") ?? "입력"}: ${error.msg ?? "형식을 확인하세요"}`).join("\n");
  if (detail && typeof detail === "object" && "reason" in detail) return String(detail.reason);
  return "설정을 확인한 뒤 다시 시도하세요.";
}
