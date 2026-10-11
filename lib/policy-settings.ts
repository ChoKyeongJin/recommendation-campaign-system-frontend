export type PolicyValue = string | number | boolean;
export type PolicySetting = {
  id: string; label: string; value: PolicyValue;
  kind: "integer" | "decimal" | "select" | "toggle";
  unit: string; hint: string; disabled: boolean;
  minimum: string | null; maximum: string | null;
  options: { value: string; label: string }[];
};
export type PolicyCard = {
  id: string; label: string; group: string; summary: string;
  settings: PolicySetting[]; notes: string[];
};
export type PolicyChange = { id: string; settings: { id: string; value: PolicyValue }[] };

export function policyValue(card: PolicyCard, setting: PolicySetting, changes: PolicyChange[]): PolicyValue {
  return changes.find((item) => item.id === card.id)?.settings.find((item) => item.id === setting.id)?.value ?? setting.value;
}

export function changePolicy(changes: PolicyChange[], card: PolicyCard, setting: PolicySetting, value: PolicyValue): PolicyChange[] {
  if (setting.disabled) return changes;
  const others = changes.filter((item) => item.id !== card.id);
  const settings = (changes.find((item) => item.id === card.id)?.settings ?? []).filter((item) => item.id !== setting.id);
  if (value !== setting.value) settings.push({ id: setting.id, value });
  return settings.length ? [...others, { id: card.id, settings }] : others;
}

export function policyValueLabel(setting: PolicySetting, value: PolicyValue): string {
  if (setting.kind === "toggle") return value === true ? "사용" : "사용 안 함";
  if (setting.kind === "select") return setting.options.find((option) => option.value === value)?.label ?? String(value);
  return `${value}${setting.unit ? ` ${setting.unit}` : ""}`;
}

export function policyInputError(setting: PolicySetting, value: PolicyValue): string {
  if (setting.kind === "toggle") return typeof value === "boolean" ? "" : "사용 여부를 선택하세요.";
  if (setting.kind === "select") return setting.options.some((option) => option.value === value) ? "" : "항목을 선택하세요.";
  if ((setting.kind === "integer" && typeof value !== "number") ||
      (setting.kind === "decimal" && typeof value !== "string")) return "올바른 숫자를 입력하세요.";
  const text = String(value);
  if (!text || text.length > 28 || !/^\d+(?:\.\d+)?$/.test(text)) return "숫자를 입력하세요.";
  const number = Number(text);
  if (!Number.isFinite(number) || (setting.kind === "integer" && !Number.isSafeInteger(number))) return "올바른 숫자를 입력하세요.";
  if ((setting.minimum !== null && number < Number(setting.minimum)) ||
      (setting.maximum !== null && number > Number(setting.maximum))) {
    return setting.maximum !== null ? `${setting.minimum ?? "0"}~${setting.maximum}${setting.unit} 범위로 입력하세요.`
      : `${setting.minimum}${setting.unit} 이상 입력하세요.`;
  }
  return "";
}

export function policyChangesValid(cards: PolicyCard[], changes: PolicyChange[]): boolean {
  return changes.every((change) => {
    const card = cards.find((item) => item.id === change.id);
    return !!card && change.settings.every((changed) => {
      const setting = card.settings.find((item) => item.id === changed.id);
      return !!setting && !setting.disabled && !policyInputError(setting, changed.value);
    });
  });
}
