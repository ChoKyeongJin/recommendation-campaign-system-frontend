export type Channel = "LMS" | "RCS";

export type TargetSegment = {
  label: string;
  count?: number;
};

export type TargetSegmentGroup = {
  title: string;
  segments: TargetSegment[];
  /** segment_composition 의 원본 키 (relevance 매핑용) */
  key?: string;
  /** 1 = 질문이 직접 지정한 핵심 조건, 2 = 목적/발송을 위한 보조 조건 */
  priority?: number;
  /** 이 그룹을 노출하는 이유 (질문과의 관련성) */
  reason?: string;
};

/** 신뢰도 근거 한 건. kind: confirmed(문서·스키마 직접 확인) | inferred(AI 추론). */
export type ConfidenceEvidence = {
  source_type: string;
  ref: string;
  detail: string;
  kind: "confirmed" | "inferred";
};

/** WHERE 조건 하나에 대한 신뢰도·근거·경고. */
export type ConfidenceCondition = {
  key: string;
  ko_label: string;
  score: number;
  verified: boolean;
  evidence: ConfidenceEvidence[];
  warnings: string[];
};

/** 백엔드(confidence.py)가 산정한 타겟팅 SQL 신뢰도. api_response.confidence 그대로. */
export type TargetingConfidence = {
  overall_score: number;
  level: string;
  dimensions: Record<string, number>;
  dimension_weights?: Record<string, number>;
  conditions: ConfidenceCondition[];
  warnings: string[];
};

/** 0명 결과일 때 어느 조건이 명단을 비웠는지 백엔드가 술어별 COUNT 로 귀속한 진단. */
export type TargetingCardinalityDiagnostic = {
  /** predicate_empty=단독으로도 0명 · predicate_interaction=조합이 0명 · probe_incomplete=결론 보류 */
  cause?: string;
  memberTotal?: number | null;
  culpritPredicates: string[];
  injectedDefaultIsCulprit?: boolean;
};

/** 타겟팅 실패·부분추출 시 "어디를 보강하면 좋을지" 힌트를 만들기 위한 원신호 (백엔드 api_response 발췌). */
export type TargetingDiagnostics = {
  status?: string;
  failureReason?: string;
  /** 실DB 로 못 옮겨 명단을 못 뽑게 한 조건들(경로 / 한글 라벨) */
  unsupportedConditions: string[];
  unsupportedConditionLabels: string[];
  /** SQL 은 나왔지만 실DB 미지원이라 빠진 조건들(부분추출) */
  droppedConditions: string[];
  droppedConditionLabels: string[];
  /** 입력 부족·모호로 되물음이 필요한 조건 */
  missingInputConditions: string[];
  clarificationQuestions: string[];
  cardinality?: TargetingCardinalityDiagnostic | null;
};

/** 파이프라인 단계 하나 (스텝퍼 렌더링용). */
export type TargetingFailureStageStep = {
  order: number;
  code: string;
  label: string;
};

/** 타겟 SQL 생성이 어느 단계에서 막혔는지(어디서). 성공이면 백엔드가 null 을 준다. */
export type TargetingFailureStage = {
  /** 실패 단계 code (예: sql_safety_validation) */
  code: string;
  /** 실패 단계 한글 라벨 (예: SQL 안전 검증) */
  label: string;
  /** 실패 단계 순번 (1-base) */
  order: number;
  /** 전체 단계 수 */
  total: number;
  /** 원 실패 사유 코드 (예: sql_guard_failed) */
  reason: string;
  /** 전체 파이프라인 단계 목록 (스텝퍼용) */
  pipeline: TargetingFailureStageStep[];
};

/** 되묻기 질문의 선택지 하나. 값(value)은 백엔드가 슬롯에 넣는 canonical 값이다. */
export type ClarificationOption = {
  id: string;
  label: string;
};

/**
 * 백엔드 확정 계층(Resolution)이 만든 되묻기 질문 하나.
 *
 * 답할 때는 issueId 를 그대로 돌려준다 — 답을 프롬프트에 이어 붙이지 않는다.
 * 백엔드는 그 결핍이 가리키는 의미 슬롯 하나만 고친다.
 */
export type ClarificationQuestion = {
  questionId: string;
  issueId: string;
  /** 닫힌 질문 코드 (예: AMBIGUOUS_AMOUNT_GRAIN) */
  code: string;
  text: string;
  /** 이 답이 확정하는 의미 슬롯 (예: comparison.grain) */
  slot: string;
  options: ClarificationOption[];
  /** 선택지가 없고 직접 입력해야 하는 질문 (상품명 등) */
  allowFreeText: boolean;
  entityType?: string | null;
  /** 이 질문이 가리키는 원문 구간 */
  evidenceText?: string;
};

/** 사용자가 말하지 않았지만 운영 정책이 채운 의미 하나의 영수증. */
export type ResolutionAssumption = {
  code: string;
  slot: string;
  value: unknown;
  /** policy_default = 배포 설정 · user_clarification = 사용자가 답한 값 */
  provenance: string;
  evidenceText?: string;
};

/** 미지원으로 닫힌 조건 하나(사용자가 답해도 열리지 않는다). */
export type ResolutionUnsupported = {
  kind: string;
  message: string;
  evidenceText?: string;
};

/** api_response.resolution — 확정 계층의 결과 블록. */
export type TargetingResolution = {
  status: "resolved" | "needs_clarification" | "unsupported";
  /** exact = 모든 의미가 사용자의 말 · assumed = 정책/답변이 채운 값이 있다 */
  resolution: "exact" | "assumed";
  /** 이 배포의 자동 확정 허용선 (strict | safe_defaults | best_effort) */
  mode: string;
  assumptions: ResolutionAssumption[];
  questions: ClarificationQuestion[];
  /** 질문 수 상한 때문에 이번에 보여주지 않은 질문 수 */
  deferredQuestionCount?: number;
  unsupported?: ResolutionUnsupported[];
};

/**
 * 되묻기 답 하나. 선택지 질문은 optionId, 자유 입력 질문은 text 를 채운다.
 *
 * slot/optionLabel/questionText 는 화면 전용이다(백엔드로 보내지 않는다).
 * 백엔드는 라운드마다 issueId 를 새로 만들기 때문에, 같은 결핍을 다시 물었는지
 * 판단하려면 issueId 가 아니라 의미 슬롯(slot)으로 맞춰 봐야 한다.
 */
export type ClarificationAnswer = {
  issueId: string;
  optionId?: string;
  text?: string;
  /** 표시 전용: 이 답이 확정하려던 의미 슬롯 (예: predicate.product) */
  slot?: string;
  /** 표시 전용: 선택지 질문에서 고른 항목의 라벨 */
  optionLabel?: string;
  /** 표시 전용: 무엇에 답했는지 되짚어 주기 위한 질문 문구 */
  questionText?: string;
};

export type TargetingResult = {
  campaignId?: string;
  total: number | null;
  resultRowCount?: number | null;
  targetCampaignCount?: number | null;
  segments: TargetSegment[];
  segmentGroups?: TargetSegmentGroup[];
  /** 질문과 무관해 기본 접어두는 프로필/통계 그룹 (사용자가 요청 시 노출) */
  hiddenSegmentGroups?: TargetSegmentGroup[];
  /** 오타·띄어쓰기 등을 정리한 정규화 프롬프트 (원문과 다를 때만 표시) */
  normalizedPrompt?: string;
  /** 오디언스(누구를 타겟하는가)만 담은 표시용 라벨. offer·행동·채널이 빠진 값이라 "타겟팅 프롬프트"에 우선 사용 */
  targetingLabel?: string;
  sql: string;
  message?: string;
  sampleRows?: Record<string, string | number | null>[];
  /** 생성 SQL 신뢰도(전체/조건별 점수·근거·경고). 검증 SQL이 없으면 null. */
  confidence?: TargetingConfidence | null;
  /** 실패·부분추출 진단 원신호. "보강 힌트"(buildReinforcementHints)의 입력. */
  diagnostics?: TargetingDiagnostics | null;
  /** 타겟 SQL 생성이 막힌 파이프라인 단계(어디서). 성공이면 null. */
  failureStage?: TargetingFailureStage | null;
  /** 확정 계층 결과: 자동 확정 영수증 · 되묻기 질문 · 미지원 사유. */
  resolution?: TargetingResolution | null;
};

/** Graph 확장 경로의 한 노드 (출발점 A ─관계→ B ─관계→ 목표). */
export type TargetingTracePathNode = {
  /** 노드 표시명 (title) */
  label: string;
  /** 노드 유형 (schema_table, schema_column 등) */
  type?: string;
  /** 직전 노드에서 이 노드로 온 관계명 (출발점=undefined) */
  relation?: string;
};

export type TargetingTraceHit = {
  label: string;
  score?: number;
  /** 유형 태그 등 (예: normalization_rule, sql_example, seed) */
  meta?: string;
  /** 스니펫·도달 경로 등 부가 설명 (한 줄) */
  note?: string;
  /** Graph 확장 노드의 유형 (schema_table 등) — 한글 유형 배지에 사용 */
  nodeType?: string;
  /** 출발점(seed)에서 떨어진 홉 수 (0 = seed 자신) */
  distance?: number;
  /** 출발점 → 목표 노드까지의 확장 경로 (관계명 포함) */
  path?: TargetingTracePathNode[];
};

export type TargetingTraceStep = {
  /** 원본 stage 번호 (1~10) */
  step?: number;
  /** 단계 제목 (stage.name 우선) */
  title: string;
  /** 처리 방식 배지: "혼합"=LLM 사용 · "규칙"=결정론 */
  method?: string;
  /** 기술명 (예: Query Plan (build_query_plan)) */
  techName?: string;
  /** 이 단계가 참조한 프롬프트/데이터/모델 (화면 "참조" 배지) */
  refs?: { kind: string; name: string; used?: boolean }[];
  /** 한 줄 요약 (예: intent=recommend_campaign, 8건) */
  summary?: string;
  /** 비즈니스 사용자용 사람 말 설명 라인들 (details보다 상위에 노출) */
  plain?: string[];
  /** 세부 설명 라인들 (내부 값·JSON 등 기술 정보 → '자세히' 토글로) */
  details?: string[];
  /** 검색 히트/그래프 노드 (score 있으면 막대로 표시) */
  hits?: TargetingTraceHit[];
  /** 히트 총 건수 (목록보다 많을 수 있음) */
  hitCount?: number | null;
  /** ok/success=완료 · fail=실패 · skipped=미실행(해당 없음/오류 이후) · info=정보 */
  status?: "success" | "ok" | "fail" | "info" | "skipped";
};

/** 트레이스 실패 원인 판정. 참조 데이터·입력·환경·개발/정책 점검을 구분한다. */
export type TargetingTraceFailureDiagnosis = {
  category: string;
  label: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  evidence: string[];
  nextAction: string;
};

export type TargetingTrace = {
  /** 원본 질의문 */
  query?: string;
  steps: TargetingTraceStep[];
  failureDiagnosis?: TargetingTraceFailureDiagnosis;
  result?: {
    status?: string;
    success?: boolean | null;
    message?: string;
  };
  execution?: {
    success?: boolean | null;
    targetCustomerCount?: number | null;
    resultRowCount?: number | null;
    targetCampaignCount?: number | null;
  };
  /** 단계별 소요 시간 (ms) */
  timings?: { label: string; ms: number }[];
  /** 단계를 하나도 복원하지 못했을 때 원본 확인용 */
  raw?: unknown;
};

export type CampaignMessage = {
  id: number;
  title: string;
  body: string;
  tone: string;
  variant?: string;
  buttons?: {
    name: string;
    url?: string;
  }[];
};

export type MessagePerformance = {
  id: number;
  title: string;
  sent: number;
  clicks: number;
  ctr: number; // percent
};

export type CampaignExperimentVariant = {
  variant_id?: number;
  experiment_id?: number;
  variant_code?: string;
  message_name?: string;
  message_body?: string;
  landing_url?: string | null;
  allocation_weight?: number;
  is_control?: boolean;
  ai_features?: Record<string, string | number | boolean | null>;
  created_at?: string;
};

export type CampaignExperimentAnalysis = {
  winner?: string | null;
  confidence?: string;
  primaryMetricUsed?: string;
  summary?: string;
  observations?: string[];
  risks?: string[];
  next_actions?: string[];
  suggested_message?: string | null;
};

export type CampaignCtrScoreValue = {
  key?: string;
  label: string;
  displayValue: string;
  reason?: string;
};

export type CampaignCtrDisplayValue = {
  displayValue: string;
};

export type CampaignCtrScoreSummary = {
  appliedRuleCount?: number;
  notAppliedRuleCount?: number;
  appliedAdjustmentTotal?: CampaignCtrDisplayValue;
  calibrationAdjustmentTotal?: CampaignCtrDisplayValue;
  totalDeltaFromBase?: CampaignCtrDisplayValue;
};

export type CampaignCtrRuleEvaluation = {
  key?: string;
  applied?: boolean;
  appliedDelta?: CampaignCtrDisplayValue;
  reason?: string;
};

export type CampaignCtrScoreBreakdown = {
  explanationBullets?: string[];
  ruleEvaluations?: CampaignCtrRuleEvaluation[];
};

export type CampaignCtrVariantScore = {
  variantCode: string;
  rank?: number;
  name: string;
  isSelected?: boolean;
  predictedClickProbability?: number;
  displayValue: string;
  deltaVsBest?: CampaignCtrDisplayValue;
  scoreSummary?: CampaignCtrScoreSummary;
  scoreBreakdown?: CampaignCtrScoreBreakdown;
};

export type CampaignCtrScore = {
  title: string;
  selectedVariantCode?: string;
  modelVersion?: string;
  variantScores?: CampaignCtrVariantScore[];
  baseScore?: CampaignCtrScoreValue;
  adjustments?: CampaignCtrScoreValue[];
  calibrationAdjustments?: CampaignCtrScoreValue[];
  predictedCtr?: CampaignCtrScoreValue;
};

export type CampaignExperimentResult = {
  is_success?: boolean;
  status?: string;
  experimentId?: number;
  experimentCreated?: boolean;
  experiment?: {
    experiment_id?: number;
    campaign_id?: string;
    experiment_name?: string;
    channel?: string;
    status?: string;
    assignment_method?: string;
    primary_metric?: string;
    started_at?: string;
    ended_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  variants?: CampaignExperimentVariant[];
  createdAssignmentCount?: number;
  skippedAssignmentCount?: number;
  assignments?: unknown[];
  skipped?: { userId?: string; reason?: string }[];
  analysis?: CampaignExperimentAnalysis;
  performance?: MessagePerformance[];
  ctrScore?: CampaignCtrScore;
};

// 간단한 문자열 해시로 프롬프트에 따라 결과가 달라지도록 함 (목업)
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function generateTargeting(prompt: string): TargetingResult {
  const seed = hash(prompt || "default");
  const base = 12000 + (seed % 48000);

  const segmentDefs = [
    "최근 30일 내 앱 방문",
    "장바구니 미결제 고객",
    "6개월 이상 휴면 고객",
    "VIP 등급 고객",
    "신규 가입 7일 이내",
    "이벤트 참여 이력 보유",
  ];

  const segments: TargetSegment[] = segmentDefs
    .map((label, i) => ({
      label,
      count: Math.round(
        base *
          (0.12 + (hash(label + prompt) % 30) / 100) *
          (i % 2 === 0 ? 1 : 0.7),
      ),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const total = segments.reduce((sum, s) => sum + (s.count ?? 0), 0);

  const sql = `SELECT c.customer_id, c.phone, c.grade
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE c.marketing_opt_in = true
  AND c.last_active_at >= NOW() - INTERVAL '30 days'
  AND ( o.status = 'cart_abandoned'
        OR c.grade IN ('VIP', 'GOLD') )
GROUP BY c.customer_id, c.phone, c.grade
HAVING COUNT(o.order_id) >= 0;
-- 예상 타겟: ${total.toLocaleString()}명`;

  return { total, segments, sql };
}

const toneOptions = [
  "혜택 강조형",
  "긴급성 강조형",
  "친근한 대화형",
  "프리미엄형",
  "정보 전달형",
];

export function generateMessages(
  prompt: string,
  channel: Channel,
): CampaignMessage[] {
  const seed = hash(prompt + channel);
  const topic = prompt.trim() || "신규 프로모션";

  const templates: Omit<CampaignMessage, "id">[] = [
    {
      title: "혜택 중심 메시지",
      tone: pick(toneOptions, seed),
      body:
        channel === "RCS"
          ? `[${topic}] 지금 확인하세요!\n고객님만을 위한 특별 혜택이 준비되어 있어요. 아래 버튼을 눌러 자세한 내용을 확인해 보세요. 👉`
          : `(광고) [${topic}]\n고객님을 위한 특별 혜택 안내! 지금 확인하고 놓치지 마세요. 수신거부 080-000-0000`,
    },
    {
      title: "긴급성 강조 메시지",
      tone: pick(toneOptions, seed + 1),
      body:
        channel === "RCS"
          ? `⏰ ${topic} 마감 임박!\n오늘까지만 제공되는 한정 혜택입니다. 지금 바로 참여하고 혜택을 받아가세요.`
          : `(광고) ${topic} 오늘 마감!\n한정 수량 소진 시 조기 종료됩니다. 지금 바로 확인하세요. 수신거부 080-000-0000`,
    },
    {
      title: "개인화 추천 메시지",
      tone: pick(toneOptions, seed + 2),
      body:
        channel === "RCS"
          ? `${topic}\n고객님의 관심사에 딱 맞는 상품을 추천해 드려요. 지금 확인하고 나만의 혜택을 만나보세요. 🎁`
          : `(광고) ${topic}\n고객님 맞춤 추천 상품이 도착했어요. 앱에서 확인해 보세요. 수신거부 080-000-0000`,
    },
  ];

  return templates.map((t, i) => ({ id: i + 1, ...t }));
}

export function generatePerformance(
  prompt: string,
  channel: Channel,
  messages: CampaignMessage[],
  total: number,
): MessagePerformance[] {
  return messages.map((m) => {
    const seed = hash(prompt + channel + m.title);
    // RCS가 LMS보다 대체로 클릭률이 높게 나오도록 목업
    const baseCtr = channel === "RCS" ? 6.5 : 3.2;
    const ctr = +(baseCtr + (seed % 45) / 10).toFixed(1);
    const sent = total;
    const clicks = Math.round((sent * ctr) / 100);
    return { id: m.id, title: m.title, sent, clicks, ctr };
  });
}
