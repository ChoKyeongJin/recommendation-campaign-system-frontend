import type { NewPolicy, PolicyCard, PolicyChange } from "./policy-settings.ts";

export type ValueRow = { canonical: string; physical: string | number | boolean | null; label: string; description: string };
export type ProfileField = {
  source: string; column: string; data_type: string; label?: string;
  allowed_operators?: string[]; unit?: string; value_domain?: string;
  expression?: string; semantic_visibility?: string; _onboarding_gaps?: Record<string, unknown>;
  semantic_description?: string; setup_editable?: boolean;
};
export type Coverage = { expressible?: boolean; reason?: string; fields?: string[]; sources?: string[]; negated_sources?: string[] };
export type DatabaseColumn = {
  name: string; data_type: string | null; nullable: boolean | null; primary_key: boolean; field_ids: string[];
  configured_field_ids?: string[]; draft_field_ids?: string[]; internal_field_ids?: string[]; structural_roles?: string[];
};
export type DatabaseColumnRow = DatabaseColumn & { key: string; table: string; database: string | null };
export function databaseColumnStatus(column: DatabaseColumn, fields: Record<string, ProfileField>): string {
  const configured = column.configured_field_ids ?? column.field_ids.filter((id) => fields[id] && !fields[id]._onboarding_gaps && fields[id].semantic_visibility !== "lowering_only");
  if (configured.length) return `조건 설정 ${configured.length}개 연결`;
  if (column.field_ids.some((id) => fields[id]?._onboarding_gaps)) return "필드 의미 설정 필요";
  if (column.internal_field_ids?.length) return "내부 계산에 사용 중";
  if (column.structural_roles?.length) return "관계·기준 키로 사용";
  return "고객·사건 연결 필요";
}
export type FieldConnection = {
  id: string; field_id: string; source: string; source_label: string; source_table: string;
  table: string; column: string; data_type: string; nullable: boolean; kind: "direct" | "lookup";
  keys: { source_column: string; target_column: string }[]; allowed_operators: string[];
};
export type NewField = {
  binding_id: string; label: string; semantic_description: string; allowed_operators: string[];
  unit: string | null; value_domain: string | null; negative_null_policy: "include_unknown" | "exclude_unknown";
};
export type SetupSnapshot = {
  apply?: { available: boolean; job: ApplyJob | null };
  database?: {
    available: boolean; selected: string; revision: string;
    options: { id: string; label: string; database: string }[];
  } | null;
  profile: string; revision: string; restart_required: boolean;
  subject: { name?: string; table: string; key: string; label?: string };
  fields: Record<string, ProfileField>;
  field_connections?: FieldConnection[];
  database_schema?: {
    tables: { name: string; database: string | null; columns: DatabaseColumn[] }[];
    unmapped_field_ids: string[];
  };
  domains: Record<string, { label: string; editable: boolean; values: ValueRow[] }>;
  sources: Record<string, { label: string; table: string }>;
  families: string[]; coverage: Record<string, Coverage>;
  basics: { base_entity: { age_column?: string }; active_state: { column?: string; value?: ValueRow["physical"]; _supported?: boolean } };
  files: string[];
  policies?: PolicyCard[];
};

export function editableField(field: ProfileField): boolean {
  return field.semantic_visibility !== "lowering_only" && (field.setup_editable ?? !("expression" in field));
}

export function connectionError(field: NewField, option: FieldConnection | undefined): string {
  if (!option) return "연결할 고객·사건을 선택하세요.";
  if (!field.label.trim() || !field.semantic_description.trim()) return "필드 이름과 저장된 값의 의미를 입력하세요.";
  if (option.data_type === "number" && !field.unit?.trim()) return "숫자의 단위를 입력하세요.";
  if (!field.allowed_operators.length) return "허용할 비교를 하나 이상 선택하세요.";
  const allowed = field.value_domain ? option.allowed_operators.filter((op) => ["=", "!=", "in", "not_in"].includes(op)) : option.allowed_operators;
  if (field.allowed_operators.some((op) => !allowed.includes(op))) return "자료형·값 목록에 맞는 비교를 선택하세요.";
  if (option.data_type === "date" && ![">=", "<"].every((op) => field.allowed_operators.includes(op))) return "날짜 기간 조건에는 이상과 미만 비교가 필요합니다.";
  return "";
}

export function databaseColumns(snapshot: SetupSnapshot): DatabaseColumnRow[] {
  return (snapshot.database_schema?.tables ?? []).flatMap((table) => table.columns.map((column) => ({
    ...column, key: JSON.stringify([table.name, column.name]), table: table.name, database: table.database,
  })));
}

export function filterDatabaseColumns(
  rows: DatabaseColumnRow[], fields: SetupSnapshot["fields"], query: string, table: string,
  changes: FieldChange[] = [],
): DatabaseColumnRow[] {
  const term = query.trim().toLowerCase();
  return rows.filter((row) => (!table || row.table === table) && [row.database, row.table, row.name,
    ...row.field_ids.flatMap((id) => [id, fields[id]?.label, changes.find((item) => item.id === id)?.label]),
  ].join(" ").toLowerCase().includes(term));
}

export type ApplyJob = {
  id: string; revision: string;
  status: "queued" | "indexing" | "restarting" | "ready" | "failed";
  code: string;
  database_target?: string | null;
};
export const applyingSettings = (job: ApplyJob | null | undefined) =>
  !!job && ["queued", "indexing", "restarting"].includes(job.status);
export function applyMessage(job: ApplyJob): string {
  if (job.database_target) {
    if (job.status === "queued") return "선택한 DB의 연결과 데이터 구조를 확인하고 있습니다.";
    if (job.status === "indexing") return "선택한 DB의 검색 정보를 준비하고 있습니다.";
    if (job.status === "restarting") return "DB 연결을 전환하고 정상 동작을 확인하고 있습니다.";
    if (job.status === "ready") return "DB 연결을 전환했습니다.";
    const errors: Record<string, string> = {
      database_check_failed: "선택한 DB의 접속·스키마 검사를 통과하지 못했습니다. 기존 연결을 유지합니다.",
      database_switch_failed: "DB 전환에 실패하여 기존 연결로 복구했습니다.",
      database_rollback_failed: "DB 연결 복구를 확인하지 못했습니다. 서버 상태를 확인해 주세요.",
      apply_interrupted: "DB 전환이 중단되었습니다. 현재 연결을 다시 확인해 주세요.",
      revision_conflict: "DB 선택 설정이 변경되었습니다. 화면을 새로 불러와 주세요.",
    };
    return errors[job.code] ?? "DB 전환에 실패했습니다. 현재 연결을 다시 확인해 주세요.";
  }
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
  semantic_description?: string;
};
export type CoverageChange = {
  family: string; mode: "supported" | "unsupported"; reason: string;
  fields: string[]; sources: string[]; negated_sources: string[];
};
export type SetupChanges = {
  fields: FieldChange[];
  new_fields: NewField[];
  domains: { id: string; values: ValueRow[]; field_id?: string }[];
  coverage: CoverageChange[];
  basics?: { active_column: string; active_value: ValueRow["physical"] };
  policies?: PolicyChange[];
  new_policies?: NewPolicy[];
};

export const emptyChanges = (): SetupChanges => ({ fields: [], new_fields: [], domains: [], coverage: [] });
export function replaceChange<T>(items: T[], updated: T, same: (item: T) => boolean): T[] {
  return [...items.filter((item) => !same(item)), updated];
}
export const editCount = (changes: SetupChanges) => changes.fields.length + changes.new_fields.length + changes.domains.length + changes.coverage.length + (changes.basics ? 1 : 0) + (changes.policies?.length ?? 0) + (changes.new_policies?.length ?? 0);
export function fieldChange(id: string, field: ProfileField): FieldChange {
  return { id, label: field.label ?? "", allowed_operators: field.allowed_operators ?? [],
    unit: field.unit ?? null, value_domain: field.value_domain ?? null, enable_draft: false,
    ...(field.semantic_description !== undefined ? { semantic_description: field.semantic_description } : {}) };
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
