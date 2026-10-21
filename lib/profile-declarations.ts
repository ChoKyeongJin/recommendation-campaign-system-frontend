import type { SetupSnapshot, ValueRow } from "./profile-setup.ts";

// Declarations the setup screen authors beside fields and value lists: events, aggregate metrics,
// the metric ranking policy and new profiles. The server offers every table/column choice; the
// screen only picks among them and names them, and checks here mirror the server's refusals.

export type EventConnection = {
  id: string; table: string; link_column: string; time_column: string; clock: "date" | "timestamp";
  row_identity: string[]; kind: "subject_column" | "fact_table"; foreign_key: boolean;
};
export type EventView = {
  label: string; aliases: string[]; table: string; link_column: string; time_column: string;
  clock: "date" | "timestamp"; kind: string; timezone: string | null; semantic_description: string;
};
export type NewEvent = { binding_id: string; id: string; label: string; aliases: string[]; semantic_description: string; timezone: string };
export type MetricFunction = "count" | "sum" | "avg" | "min" | "max";
export type MetricView = {
  label: string; source: string; function: MetricFunction; measure_field: string | null; unit: string | null;
  ranking: boolean; semantic_description: string;
};
export type NewMetric = {
  id: string; source: string; function: MetricFunction; measure_field: string | null; label: string;
  aliases: string[]; semantic_description: string; ranking: boolean;
};
export type RankingPolicyView = {
  label: string; limit_units: string[]; tie_policy: string | null; fixed: Record<string, string>;
  population_field: string | null; population_value: string | null;
};
export type RankingPolicyChange = {
  label: string; limit_units: ("count" | "percent")[]; tie_policy: "exact_count" | "include_boundary_ties";
  population_field: string; population_value: string;
};

export const IDENTIFIER = /^[a-z][a-z0-9_]{1,39}$/;
export const METRIC_FUNCTIONS: [MetricFunction, string][] = [
  ["count", "횟수(기록 수)"], ["sum", "합계"], ["avg", "평균"], ["min", "최솟값"], ["max", "최댓값"],
];
export const TIE_POLICIES: [RankingPolicyChange["tie_policy"], string][] = [
  ["exact_count", "정확히 N명(동점은 키 순서로 자름)"], ["include_boundary_ties", "경계 동점 모두 포함"],
];

const surfaces = (label: string, aliases: string[]) => [label.trim(), ...aliases.map((alias) => alias.trim())];
function surfacesError(label: string, aliases: string[]): string {
  const all = surfaces(label, aliases);
  if (all.some((item) => !item)) return "이름과 다른 이름을 빈칸 없이 입력하세요.";
  if (new Set(all).size !== all.length) return "이름과 다른 이름이 중복되지 않게 입력하세요.";
  return "";
}

export function eventError(event: NewEvent, snapshot: SetupSnapshot, pending: NewEvent[]): string {
  const option = snapshot.event_connections?.find((item) => item.id === event.binding_id);
  if (!option) return "사건으로 쓸 표와 컬럼을 고르세요.";
  if (!IDENTIFIER.test(event.id)) return "사건 ID는 영문 소문자로 시작하는 2~40자(소문자·숫자·_)로 입력하세요.";
  const taken = event.id === "subject" || event.id in (snapshot.events ?? {}) || event.id in (snapshot.sources ?? {})
    || Object.keys(snapshot.fields).some((id) => id.startsWith(`${event.id}.`))
    || pending.some((item) => item !== event && item.id === event.id);
  if (taken) return "이미 쓰이는 사건 ID입니다.";
  if (pending.some((item) => item !== event && item.binding_id === event.binding_id)) return "같은 표·컬럼 조합을 두 번 추가했습니다.";
  const surface = surfacesError(event.label, event.aliases);
  if (surface) return surface;
  if (!event.semantic_description.trim()) return "이 사건이 무엇을 기록하는지 설명을 입력하세요.";
  if (!event.timezone.trim()) return "날짜가 기록된 시간대를 입력하세요(예: Asia/Seoul).";
  return "";
}

/** Saved events that happen many times per subject: the only sources an aggregate can count over. */
export function repeatedEvents(snapshot: SetupSnapshot): [string, string][] {
  return Object.entries(snapshot.events ?? {}).filter(([, event]) => event.kind === "fact_table").map(([id, event]) => [id, event.label]);
}

export function measureFields(snapshot: SetupSnapshot, source: string): [string, string][] {
  return Object.entries(snapshot.fields).filter(([, field]) => field.source === source && field.data_type === "number"
    && field.semantic_visibility !== "lowering_only" && !field._onboarding_gaps && !!field.unit)
    .map(([id, field]) => [id, `${field.label || field.column} (${field.unit})`]);
}

export function metricError(metric: NewMetric, snapshot: SetupSnapshot, pending: NewMetric[], ranking: boolean): string {
  if (!IDENTIFIER.test(metric.id)) return "지표 ID는 영문 소문자로 시작하는 2~40자(소문자·숫자·_)로 입력하세요.";
  if (metric.id in (snapshot.metrics ?? {}) || metric.id in (snapshot.sources ?? {}) || pending.some((item) => item !== metric && item.id === metric.id)) {
    return "이미 쓰이는 지표 ID입니다.";
  }
  if (!repeatedEvents(snapshot).some(([id]) => id === metric.source)) return "여러 번 일어나는 저장된 사건을 고르세요.";
  if (metric.function === "count" ? metric.measure_field !== null
    : !measureFields(snapshot, metric.source).some(([id]) => id === metric.measure_field)) {
    return metric.function === "count" ? "횟수는 측정 필드 없이 기록 수를 셉니다." : "이 사건의 단위가 있는 숫자 필드를 측정값으로 고르세요.";
  }
  const surface = surfacesError(metric.label, metric.aliases);
  if (surface) return surface;
  if (!metric.semantic_description.trim()) return "지표의 뜻을 입력하세요.";
  if (metric.ranking && !ranking) return "순위에 쓰려면 순위 정책을 먼저 설정하세요.";
  return "";
}

/** Subject fields bound to a value list: a ranking population is one of their values. */
export function populationFields(snapshot: SetupSnapshot): [string, string][] {
  const subject = snapshot.subject.name ?? "subject";
  return Object.entries(snapshot.fields).filter(([, field]) => field.source === subject && !!field.value_domain)
    .map(([id, field]) => [id, field.label || field.column]);
}

export function populationValues(snapshot: SetupSnapshot, fieldId: string): ValueRow[] {
  const domain = snapshot.fields[fieldId]?.value_domain;
  return domain ? snapshot.domains[domain]?.values ?? [] : [];
}

export function rankingPolicyChange(snapshot: SetupSnapshot): RankingPolicyChange {
  const current = snapshot.ranking_policy;
  return {
    label: current?.label ?? "", tie_policy: current?.tie_policy === "include_boundary_ties" ? "include_boundary_ties" : "exact_count",
    limit_units: (current?.limit_units ?? ["count", "percent"]).filter((unit): unit is "count" | "percent" => unit === "count" || unit === "percent"),
    population_field: current?.population_field ?? "", population_value: current?.population_value ?? "",
  };
}

export function rankingPolicyError(change: RankingPolicyChange, snapshot: SetupSnapshot): string {
  if (!change.label.trim()) return "순위 정책의 이름을 입력하세요.";
  if (!change.limit_units.length || new Set(change.limit_units).size !== change.limit_units.length) return "컷 단위(명·%)를 하나 이상 고르세요.";
  if (!populationFields(snapshot).some(([id]) => id === change.population_field)) return "순위 대상(모집단)을 정할 필드를 고르세요.";
  if (!populationValues(snapshot, change.population_field).some((row) => row.canonical === change.population_value)) {
    return "순위 대상이 되는 값을 고르세요.";
  }
  return "";
}

/** A value list id the value literals can carry (``literal:catalog_value:<id>:<value>``): no dots. */
export function newDomainId(fieldId: string): string {
  return `setup_${fieldId.toLowerCase().replace(/[^a-z0-9_]+/g, "_")}`.slice(0, 64);
}

export function moveValue<T>(values: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= values.length || target < 0 || target >= values.length) return values;
  const next = [...values];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ── New profile ──────────────────────────────────────────────────────────────────────────

export type ProfileTable = {
  name: string; object_type: string | null; primary_key: string[];
  columns: { name: string; type: string; nullable: boolean }[];
};
export type ProfileCreateRequest = {
  target: string; driver: "pymysql" | "pymssql"; tables: string[]; subject_table: string; subject_key: string;
  subject_label: string; age_column: string | null; active_column: string | null; active_value: string | null;
};
export const DRIVERS: [ProfileCreateRequest["driver"], string][] = [["pymysql", "MySQL·MariaDB"], ["pymssql", "SQL Server"]];

const baseType = (type: string) => type.trim().toLowerCase().split("(")[0].split(" ")[0];
export const numericColumn = (type: string) => ["int", "smallint", "bigint", "decimal"].includes(baseType(type));

export function creationError(request: ProfileCreateRequest, tables: ProfileTable[]): string {
  if (!request.tables.length) return "가져올 표를 하나 이상 고르세요.";
  const subject = tables.find((table) => table.name === request.subject_table);
  if (!subject || !request.tables.includes(subject.name)) return "조회 대상(주체) 표를 고르고 가져올 표에 포함하세요.";
  if (subject.primary_key.length !== 1 || subject.primary_key[0] !== request.subject_key) {
    return "주체 키는 주체 표의 기본 키(컬럼 하나)여야 합니다.";
  }
  if (!request.subject_label.trim()) return "주체를 부르는 이름을 입력하세요(예: 고객, 직원).";
  const column = (name: string | null) => subject.columns.find((item) => item.name === name);
  if (request.age_column !== null && !numericColumn(column(request.age_column)?.type ?? "")) return "나이 컬럼은 주체 표의 숫자 컬럼이어야 합니다.";
  if ((request.active_column === null) !== (request.active_value === null)) return "활성 상태는 컬럼과 값을 함께 정하거나 둘 다 비우세요.";
  if (request.active_column !== null && !column(request.active_column)) return "활성 상태 컬럼은 주체 표의 컬럼이어야 합니다.";
  if (request.active_value !== null && !request.active_value.trim()) return "활성 상태 값을 입력하세요.";
  return "";
}
