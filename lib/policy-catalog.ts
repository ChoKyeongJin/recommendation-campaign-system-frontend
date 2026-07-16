export type PolicyFieldType = "string" | "string[]" | "boolean" | "number";

export type PolicyField = {
  key: string;
  label: string;
  type: PolicyFieldType;
  default: unknown;
  description: string;
  widget: "text" | "tags" | "toggle" | "slider";
  min?: number;
  max?: number;
  step?: number;
  /** 이 boolean 필드가 true일 때만 활성화된다(의존 관계). */
  enabledWhen?: string;
};

export type PolicySchema = {
  title: string;
  description: string;
  fields: PolicyField[];
};

/**
 * 스키마를 아는 정책은 필드 폼으로, 모르는 정책은 raw JSON 에디터로 렌더링한다.
 * name → 스키마.
 */
export const POLICY_CATALOG: Record<string, PolicySchema> = {
  "message-generation-policy": {
    title: "메시지 생성 정책",
    description:
      "채널 메시지 생성에 사용할 LLM 파라미터를 관리합니다. temperature가 높을수록 다양하고 창의적인 문구가 생성됩니다.",
    fields: [
      {
        key: "temperature",
        label: "temperature (창의성)",
        type: "number",
        default: 0.7,
        description:
          "0에 가까울수록 안정적·반복적이고, 높을수록 다양하고 창의적인 메시지가 생성됩니다.",
        widget: "slider",
        min: 0,
        max: 2,
        step: 0.1,
      },
    ],
  },
  "ctr-model-policy": {
    title: "CTR 모델 선택/탐험 정책",
    description: "CTR 스코어링에 사용할 모델 버전과 ε-greedy 탐험 정책을 관리합니다.",
    fields: [
      {
        key: "default_model_version",
        label: "기본 모델 버전",
        type: "string",
        default: "heuristic-ctr-v1",
        description:
          "요청에 modelVersion이 없을 때 사용할 기본 모델 버전입니다.",
        widget: "text",
      },
      {
        key: "heuristic_model_version_prefixes",
        label: "휴리스틱 접두사",
        type: "string[]",
        default: ["heuristic"],
        description:
          "이 접두사로 시작하는 모델 버전은 휴리스틱 스코어러로 처리합니다(그 외는 ML 예측 경로).",
        widget: "tags",
      },
      {
        key: "fallback_to_heuristic_on_ml_error",
        label: "ML 오류 시 폴백",
        type: "boolean",
        default: true,
        description:
          "ML 예측 실패 시 휴리스틱 점수로 폴백할지 여부. 꺼지면 예측 실패가 오류로 전파됩니다.",
        widget: "toggle",
      },
      {
        key: "exploration_enabled",
        label: "탐험 활성화",
        type: "boolean",
        default: false,
        description:
          "ε-greedy 탐험 활성화 여부. 꺼지면 탐험 확률은 항상 0입니다.",
        widget: "toggle",
      },
      {
        key: "default_epsilon",
        label: "기본 ε (탐험 확률)",
        type: "number",
        default: 0.0,
        description: "탐험 확률(ε). 탐험 활성화가 켜졌을 때만 유효합니다.",
        widget: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        enabledWhen: "exploration_enabled",
      },
      {
        key: "allow_request_epsilon_override",
        label: "요청 ε 재정의 허용",
        type: "boolean",
        default: false,
        description:
          "개별 요청이 전달한 epsilon 값으로 기본 ε을 덮어쓰도록 허용할지 여부입니다.",
        widget: "toggle",
        enabledWhen: "exploration_enabled",
      },
    ],
  },
};

export function getPolicySchema(name: string): PolicySchema | null {
  return POLICY_CATALOG[name] ?? null;
}

/** 스키마 기본값으로 채워진 content 객체를 만든다(신규 정책 프리필용). */
export function buildDefaultContent(
  schema: PolicySchema,
): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const field of schema.fields) {
    content[field.key] = Array.isArray(field.default)
      ? [...field.default]
      : field.default;
  }
  return content;
}

/** 스키마에 정의되지 않은(확장/오타 가능성 있는) 키를 찾는다. */
export function findUnknownKeys(
  schema: PolicySchema | null,
  content: Record<string, unknown>,
): string[] {
  if (!schema) {
    return [];
  }
  const known = new Set(schema.fields.map((field) => field.key));
  return Object.keys(content).filter((key) => !known.has(key));
}

/** 목록에서 보여줄 한 줄 요약을 만든다. */
export function summarizeContent(content: unknown): string {
  if (!content || typeof content !== "object") {
    return "";
  }
  const record = content as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.default_model_version === "string") {
    parts.push(`기본 ${record.default_model_version}`);
  }
  if (typeof record.exploration_enabled === "boolean") {
    parts.push(`탐험 ${record.exploration_enabled ? "켜짐" : "꺼짐"}`);
  }
  if (typeof record.default_epsilon === "number") {
    parts.push(`ε=${record.default_epsilon}`);
  }
  if (parts.length > 0) {
    return parts.join(" · ");
  }
  // 스키마를 모르는 정책: 키 개수만
  return `${Object.keys(record).length}개 키`;
}
