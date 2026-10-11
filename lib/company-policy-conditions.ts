import { newPolicyNameError, type PolicyCard } from "./policy-settings.ts";

export type FieldCondition = { kind: "field"; field_id: string; operator: string; value: string | boolean; unit: string | null };
export type MetricCondition = { kind: "metric"; metric_id: string; operator: string; value: string; unit: string; days: number };
export type EventCondition = { kind: "event"; source_id: string; mode: "exists" | "absent"; days: number; where: ConditionGroup | null };
export type ConditionGroup = { kind: "group"; mode: "all" | "any"; children: PolicyCondition[] };
export type PolicyCondition = FieldCondition | MetricCondition | EventCondition | ConditionGroup;
export type ConditionPolicyCreate = { name: string; condition: ConditionGroup };
export type ConditionPolicyEdit = { id: string; condition: ConditionGroup };
export type ConditionField = { id: string; label: string; source_id: string; kind: "string" | "number" | "boolean" | "enum";
  operators: string[]; unit: string | null; choices: { value: string; label: string }[]; integer: boolean; minimum: string | null; maximum: string | null };
export type ConditionOptions = { subject_source: string; fields: ConditionField[]; events: { id: string; label: string }[];
  metrics: { id: string; label: string; operators: string[]; unit: string; integer: boolean }[] };

export const comparisonLabels: Record<string, string> = { "=": "같음", "!=": "다름", ">=": "이상", ">": "초과", "<=": "이하", "<": "미만", contains: "포함", starts_with: "시작", ends_with: "끝남" };
export const unitLabel = (unit: string | null) => ({ KRW: "원", year: "세", count: "건", day: "일", second: "초", score: "점", fraction: "비율(0~1)", percent: "%" }[unit ?? ""] ?? unit ?? "");
export const blankCondition = (): FieldCondition => ({ kind: "field", field_id: "", operator: "=", value: "", unit: null });
export const blankGroup = (): ConditionGroup => ({ kind: "group", mode: "all", children: [blankCondition()] });

export function selectCondition(selection: string, menu: ConditionOptions): PolicyCondition {
  const separator = selection.indexOf(":");
  const kind = selection.slice(0, separator), id = selection.slice(separator + 1);
  if (kind === "field") {
    const field = menu.fields.find((item) => item.id === id);
    if (field) return { kind, field_id: id, operator: field.operators[0], value: field.kind === "boolean" ? false : "", unit: field.unit };
  }
  if (kind === "metric") {
    const metric = menu.metrics.find((item) => item.id === id);
    if (metric) return { kind, metric_id: id, operator: metric.operators.includes(">=") ? ">=" : metric.operators[0], value: "", unit: metric.unit, days: 30 };
  }
  if (kind === "event" && menu.events.some((item) => item.id === id)) return { kind, source_id: id, mode: "exists", days: 30, where: null };
  return blankCondition();
}

function numberValid(value: string | boolean, integer: boolean, minimum?: string | null, maximum?: string | null): boolean {
  if (typeof value !== "string" || value.length > 28 || !/^-?\d+(?:\.\d+)?$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && (!integer || Number.isInteger(number))
    && (minimum == null || number >= Number(minimum)) && (maximum == null || number <= Number(maximum));
}

export function conditionError(root: ConditionGroup, menu: ConditionOptions): string {
  let count = 0;
  function visit(node: PolicyCondition, scope: string, depth: number): string {
    count += 1;
    if (count > 60 || depth > 5) return "조건과 묶음은 60개, 중첩은 5단계까지 만들 수 있습니다.";
    if (node.kind === "group") {
      if (!node.children.length || node.children.length > 20) return "묶음마다 조건을 1~20개 넣어 주세요.";
      if (!["all", "any"].includes(node.mode)) return "묶음의 충족 방식을 선택하세요.";
      for (const child of node.children) { const error = visit(child, scope, depth + 1); if (error) return error; }
      return "";
    }
    if (node.kind === "field") {
      const field = menu.fields.find((item) => item.id === node.field_id && item.source_id === scope);
      if (!field) return "조건의 항목을 선택하세요.";
      if (!field.operators.includes(node.operator) || node.unit !== field.unit) return "필드에 맞는 비교와 단위를 선택하세요.";
      const valid = field.kind === "number" ? numberValid(node.value, field.integer, field.minimum, field.maximum)
        : field.kind === "boolean" ? typeof node.value === "boolean"
        : field.kind === "enum" ? field.choices.some((item) => item.value === node.value)
        : typeof node.value === "string" && !!node.value.trim() && node.value.length <= 200 && !/[\x00-\x1f]/.test(node.value);
      return valid ? "" : `${field.label}의 값을 확인하세요.`;
    }
    if (scope !== menu.subject_source) return "이력 안에는 같은 이력의 필드 조건을 넣어 주세요.";
    if (!Number.isInteger(node.days) || node.days < 1 || node.days > 36500) return "기간을 1~36500일로 입력하세요.";
    if (node.kind === "event") {
      if (!menu.events.some((item) => item.id === node.source_id) || !["exists", "absent"].includes(node.mode)) return "지원하는 이력을 선택하세요.";
      return node.where ? visit(node.where, node.source_id, depth + 1) : "";
    }
    const metric = menu.metrics.find((item) => item.id === node.metric_id);
    return metric && metric.unit === node.unit && metric.operators.includes(node.operator) && numberValid(node.value, metric.integer)
      ? "" : "집계 기준의 값·단위를 확인하세요.";
  }
  return visit(root, menu.subject_source, 1);
}

export function conditionPoliciesValid(menu: ConditionOptions | null | undefined, cards: PolicyCard[],
  creations: ConditionPolicyCreate[], edits: ConditionPolicyEdit[], otherNames: { name: string }[] = []): boolean {
  if (!creations.length && !edits.length) return true;
  return !!menu && creations.length <= 20 && new Set(edits.map((item) => item.id)).size === edits.length
    && creations.every((item, i) => !newPolicyNameError(item.name, cards, [...creations.filter((_, j) => i !== j), ...otherNames]) && !conditionError(item.condition, menu))
    && edits.every((item) => cards.some((card) => card.id === item.id && card.condition) && !conditionError(item.condition, menu));
}

export function conditionSummary(node: PolicyCondition, menu: ConditionOptions): string {
  if (node.kind === "group") return `(${node.children.map((child) => conditionSummary(child, menu)).join(node.mode === "all" ? " 그리고 " : " 또는 ")})`;
  if (node.kind === "event") return `최근 ${node.days}일 ${menu.events.find((item) => item.id === node.source_id)?.label ?? "이력"}${node.where ? ` 중 ${conditionSummary(node.where, menu)}에 맞는 이력` : " 이력"} ${node.mode === "exists" ? "있음" : "없음"}`;
  const option = node.kind === "field" ? menu.fields.find((item) => item.id === node.field_id) : menu.metrics.find((item) => item.id === node.metric_id);
  const shown = node.kind === "field" && option && "choices" in option ? option.choices.find((item) => item.value === node.value)?.label ?? String(node.value) : String(node.value);
  return `${node.kind === "metric" ? `최근 ${node.days}일 ` : ""}${option?.label ?? "항목 선택"} ${shown}${unitLabel(node.unit)} ${comparisonLabels[node.operator] ?? node.operator}`;
}
