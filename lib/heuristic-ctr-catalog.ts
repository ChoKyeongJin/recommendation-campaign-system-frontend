// 휴리스틱 CTR 룰(`heuristic-ctr-rules`) 정책 전용 스키마/기본값/검증.
// 폼 렌더링·검증·툴팁이 이 상수를 공유한다.

export const HEURISTIC_CTR_POLICY_NAME = "heuristic-ctr-rules";

/** 최상위 확률 파라미터(0~1). */
export type ProbabilityFieldKey =
  | "base_probability"
  | "min_probability"
  | "max_probability"
  | "stable_noise_max";

export type ProbabilityField = {
  key: ProbabilityFieldKey;
  label: string;
  default: number;
  description: string;
};

export const PROBABILITY_FIELDS: ProbabilityField[] = [
  {
    key: "base_probability",
    label: "기준 확률",
    default: 0.025,
    description: "모든 변형의 기준 예측 CTR. 여기서 조정값이 가감됩니다.",
  },
  {
    key: "min_probability",
    label: "최소 확률",
    default: 0.001,
    description: "최종 확률 하한(클램핑).",
  },
  {
    key: "max_probability",
    label: "최대 확률",
    default: 0.25,
    description: "최종 확률 상한(클램핑).",
  },
  {
    key: "stable_noise_max",
    label: "노이즈 최대",
    default: 0.01,
    description:
      "user·variant 조합으로 결정되는 안정적 노이즈의 최대치입니다.",
  },
];

/** `score_adjustments`의 고정 8개 키. 값은 음수(감점) 허용. */
export type ScoreAdjustmentKey =
  | "preferred_channel"
  | "campaign_category_interest_match"
  | "high_price_sensitivity_with_price_offer"
  | "urgency_with_recent_behavior"
  | "personalized_lifecycle_match"
  | "message_length_medium"
  | "message_length_long"
  | "control_variant";

export type ScoreAdjustmentField = {
  key: ScoreAdjustmentKey;
  label: string;
  default: number;
  description: string;
};

export const SCORE_ADJUSTMENT_FIELDS: ScoreAdjustmentField[] = [
  {
    key: "preferred_channel",
    label: "선호 채널 일치",
    default: 0.012,
    description: "사용자의 선호 채널과 변형 채널이 일치할 때 가점.",
  },
  {
    key: "campaign_category_interest_match",
    label: "카테고리 관심 일치",
    default: 0.01,
    description: "캠페인 카테고리가 사용자 관심사와 일치할 때 가점.",
  },
  {
    key: "high_price_sensitivity_with_price_offer",
    label: "가격민감 + 가격혜택",
    default: 0.012,
    description: "가격 민감 사용자에게 가격 혜택 메시지가 노출될 때 가점.",
  },
  {
    key: "urgency_with_recent_behavior",
    label: "긴급성 + 최근행동",
    default: 0.009,
    description:
      "긴급성 문구 + 매처의 긴급 최근행동 키워드에 해당하는 최근 행동일 때 가점.",
  },
  {
    key: "personalized_lifecycle_match",
    label: "라이프사이클 개인화",
    default: 0.006,
    description:
      "매처의 개인화 라이프사이클에 속하는 라이프사이클을 개인화할 때 가점.",
  },
  {
    key: "message_length_medium",
    label: "메시지 길이(중)",
    default: 0.004,
    description: "메시지 길이가 중간일 때 가점.",
  },
  {
    key: "message_length_long",
    label: "메시지 길이(장)",
    default: -0.004,
    description: "메시지 길이가 길 때 감점(음수).",
  },
  {
    key: "control_variant",
    label: "대조군",
    default: 0.001,
    description: "대조군(control) 변형일 때 가점.",
  },
];

/** `matchers`의 태그(칩) 필드. */
export type MatcherKey =
  | "urgency_recent_behavior_keywords"
  | "personalized_lifecycles";

export type MatcherField = {
  key: MatcherKey;
  label: string;
  default: string[];
  description: string;
};

export const MATCHER_FIELDS: MatcherField[] = [
  {
    key: "urgency_recent_behavior_keywords",
    label: "긴급 최근행동 키워드",
    default: ["cart_abandoned", "deal"],
    description:
      "`긴급성 + 최근행동` 가점을 트리거하는 최근 행동 키워드입니다.",
  },
  {
    key: "personalized_lifecycles",
    label: "개인화 라이프사이클",
    default: ["active", "cart_abandoner", "vip"],
    description: "`라이프사이클 개인화` 가점 대상 라이프사이클입니다.",
  },
];

export type HeuristicCtrContent = {
  base_probability: number;
  min_probability: number;
  max_probability: number;
  stable_noise_max: number;
  score_adjustments: Record<string, number>;
  matchers: Record<string, string[]>;
};

/** 코드 기본값과 동일한 전체 content 객체. */
export function buildDefaultHeuristicContent(): HeuristicCtrContent {
  const scoreAdjustments: Record<string, number> = {};
  for (const field of SCORE_ADJUSTMENT_FIELDS) {
    scoreAdjustments[field.key] = field.default;
  }
  const matchers: Record<string, string[]> = {};
  for (const field of MATCHER_FIELDS) {
    matchers[field.key] = [...field.default];
  }
  return {
    base_probability: 0.025,
    min_probability: 0.001,
    max_probability: 0.25,
    stable_noise_max: 0.01,
    score_adjustments: scoreAdjustments,
    matchers,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * DB에 일부 키만 있어도 코드 기본값과 한 단계 중첩까지 병합해 폼을 채운다.
 * (백엔드 로딩 우선순위: DB → 파일 → 코드 기본값과 동일한 병합 규칙)
 */
export function normalizeHeuristicContent(
  raw: unknown,
): HeuristicCtrContent {
  const defaults = buildDefaultHeuristicContent();
  if (!isPlainObject(raw)) {
    return defaults;
  }

  const scoreAdjustments: Record<string, number> = {
    ...defaults.score_adjustments,
  };
  if (isPlainObject(raw.score_adjustments)) {
    for (const [key, value] of Object.entries(raw.score_adjustments)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        scoreAdjustments[key] = value;
      }
    }
  }

  const matchers: Record<string, string[]> = { ...defaults.matchers };
  if (isPlainObject(raw.matchers)) {
    for (const [key, value] of Object.entries(raw.matchers)) {
      if (Array.isArray(value)) {
        matchers[key] = value.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }
  }

  return {
    base_probability: toNumber(
      raw.base_probability,
      defaults.base_probability,
    ),
    min_probability: toNumber(raw.min_probability, defaults.min_probability),
    max_probability: toNumber(raw.max_probability, defaults.max_probability),
    stable_noise_max: toNumber(
      raw.stable_noise_max,
      defaults.stable_noise_max,
    ),
    score_adjustments: scoreAdjustments,
    matchers,
  };
}

/** `score_adjustments`에서 스키마에 없는(스코어러가 무시하는) 키를 찾는다. */
export function findUnknownAdjustmentKeys(
  adjustments: Record<string, unknown>,
): string[] {
  const known = new Set<string>(SCORE_ADJUSTMENT_FIELDS.map((f) => f.key));
  return Object.keys(adjustments).filter((key) => !known.has(key));
}

export type ValidationWarning = { field: string; message: string };

/** 클라이언트 검증(§2.4). 치명적 아님 — 경고 목록을 반환한다. */
export function validateHeuristicContent(
  content: HeuristicCtrContent,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const field of PROBABILITY_FIELDS) {
    const value = content[field.key];
    if (value < 0 || value > 1) {
      warnings.push({
        field: field.label,
        message: `${field.label}은(는) 0.0 ~ 1.0 범위여야 합니다. (현재 ${value})`,
      });
    }
  }

  const { min_probability, base_probability, max_probability } = content;
  if (!(min_probability <= base_probability)) {
    warnings.push({
      field: "기준 확률",
      message: "최소 확률 ≤ 기준 확률 권장(위반). 백엔드가 최종 클램핑합니다.",
    });
  }
  if (!(base_probability <= max_probability)) {
    warnings.push({
      field: "기준 확률",
      message: "기준 확률 ≤ 최대 확률 권장(위반). 백엔드가 최종 클램핑합니다.",
    });
  }

  for (const field of SCORE_ADJUSTMENT_FIELDS) {
    const value = content.score_adjustments[field.key];
    if (typeof value === "number" && Math.abs(value) > max_probability) {
      warnings.push({
        field: field.label,
        message: `${field.label} 가감치의 절댓값(${Math.abs(value)})이 최대 확률(${max_probability})을 초과합니다.`,
      });
    }
  }

  return warnings;
}
