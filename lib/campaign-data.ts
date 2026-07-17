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

export type TargetingResult = {
  campaignId?: string;
  total: number | null;
  resultRowCount?: number | null;
  targetCampaignCount?: number | null;
  segments: TargetSegment[];
  segmentGroups?: TargetSegmentGroup[];
  /** 질문과 무관해 기본 접어두는 프로필/통계 그룹 (사용자가 요청 시 노출) */
  hiddenSegmentGroups?: TargetSegmentGroup[];
  sql: string;
  message?: string;
  sampleRows?: Record<string, string | number | null>[];
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
