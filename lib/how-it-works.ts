/**
 * 「어떻게 동작하나」 화면(`/admin/how-it-works`)이 그리는 파이프라인 선언.
 *
 * **이 화면이 그리는 배포.** 의미 해석을 `llm_primary` 모드로만 도는 배포다. 그 모드가 켜지면
 * 종결 사슬은 그 한 단에서 끝난다 — 확정이든 기권이든 미지원이든 오류든 전부 그 단이 닫고,
 * 뒤의 결정론 사슬로 새지 않는다. 그래서 provider 호출 자리가 하나로 그려진다. 다른 모드에서는
 * 호출 자리가 더 많고, 그때는 이 그림이 그 배포를 말하지 않는다.
 *
 * **단계 이름과 설명은 백엔드가 소유한다**(`target_sql_progress._METADATA`). 여기 적힌 것은
 * 그 문구를 그대로 옮긴 사본이다 — 진행 스트림은 요청이 돌 때만 이 문구를 싣고 목록을 주는
 * 엔드포인트는 없어서, 설명 화면은 사본을 들 수밖에 없다. 백엔드에서 문구를 고치면 여기도
 * 같은 작업에서 고친다.
 *
 * **판정은 옮기지 않는다.** 지금 어떤 모드로 돌고 있는지, 이번 요청이 몇 번 호출했는지는 이
 * 화면이 말하지 않는다. 그것은 진행 스트림의 `llm_call` 이벤트가 요청마다 실제로 나르는 사실이고,
 * 타겟 추출 화면이 이미 그 자리에서 보여 준다.
 */

/** 파이프라인 한 단계. `id` 는 백엔드 `ProgressStage` 값과 같다. */
export type PipelineStage = {
  readonly id: string;
  /** 백엔드가 진행 이벤트에 싣는 라벨. */
  readonly label: string;
  /** 백엔드가 진행 이벤트에 싣는 설명. */
  readonly description: string;
  /** 이 단계에서 실제로 무슨 일이 일어나는지, 원리로 한 줄. */
  readonly principle: string;
};

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    id: "request_analysis",
    label: "요청 분석",
    description: "입력 문장을 정규화하고 요청 범위를 분석합니다.",
    principle:
      "표기를 고르게 맞추고, 타겟 조건이 아닌 부분(발송 채널 같은 것)을 떼어 냅니다. 아직 의미를 정하지 않습니다.",
  },
  {
    id: "semantic_resolution",
    label: "의미 해석",
    description: "조건의 의미를 검증하고 실행 가능한 계획으로 확정합니다.",
    principle:
      "여기서 모델에게 한 번 묻습니다. 그 답은 가설일 뿐이고, 카탈로그와 정책으로 검증을 통과한 것만 실행 권위를 얻습니다.",
  },
  {
    id: "knowledge_retrieval",
    label: "관련 정보 검색",
    description: "카탈로그와 그래프에서 실행에 필요한 근거를 찾습니다.",
    principle:
      "확정된 의미가 어떤 표·컬럼·지표에 앉는지를 선언에서 찾습니다. 이름이 비슷하다는 이유로 잇지 않습니다.",
  },
  {
    id: "sql_compilation",
    label: "SQL 생성 및 검증",
    description: "계획을 안전한 SQL로 변환하고 실행 가능성을 검증합니다.",
    principle:
      "실제 표·컬럼·조인·파라미터는 이 단계만 정합니다. 값은 전부 파라미터로 묶고, 식별자는 카탈로그가 허용한 것만 씁니다.",
  },
  {
    id: "database_execution",
    label: "대상 조회",
    description: "검증된 SQL을 실행해 대상 고객을 조회합니다.",
    principle: "읽기 전용으로 실행합니다. 검증을 통과하지 못한 SQL은 여기까지 오지 않습니다.",
  },
  {
    id: "audience_materialization",
    label: "대상 저장",
    description: "조회된 대상을 재사용 가능한 오디언스로 저장합니다.",
    principle: "어떤 요청이 어떤 근거로 이 대상을 만들었는지가 함께 남습니다.",
  },
];

/** 모델을 부르는 단계. 이 배포에서는 한 자리뿐이다. */
export const LLM_STAGE_ID = "semantic_resolution";

/** 의미를 증명하지 못했을 때 멈추는 단계 — 뒤 단계는 아예 돌지 않는다. */
export const FAIL_CLOSE_STAGE_ID = "semantic_resolution";

/** 모델 호출 한 번에 오가는 것. */
export const LLM_EXCHANGE = {
  mode: "llm_primary",
  callLabel: "의미 후보 구조화",
  /** 모델에게 보내는 것. */
  sends: [
    "사용자가 쓴 원문 전체",
    "선언된 후보 전체 — 이 배포가 표현할 수 있는 개념·필드·지표의 메뉴",
    "제출할 수 있는 의미의 형상(논리 구조·시간·집합 등)",
  ],
  /** 모델이 돌려주는 것. */
  returns: [
    "어떤 의미를 말한 것인지 — 개념 후보와 논리 구조(그리고/또는/아님)",
    "그 판단의 근거로 원문의 어느 구절을 읽었는지",
    "확정할 수 없으면 모호·기권 — 지어내지 않고 그렇게 말합니다",
  ],
} as const;

/** 호출 횟수에 대한 사실. 숫자를 흐리지 않는다. */
export const CALL_BUDGET: readonly string[] = [
  "요청 하나에 모델 호출은 1번입니다.",
  "근거로 댄 구절이 원문에 없거나 여러 곳에 걸리면 한 번만 다시 묻도록 켤 수 있습니다(그때 최대 2번). 기본은 꺼져 있습니다.",
  "의미 해석이나 SQL 검증이 실패했다는 이유로는 다시 묻지 않습니다 — 실패는 정상적인 답이지 재시도 사유가 아닙니다.",
  "이 모드가 켜져 있으면 요청은 여기서 끝납니다. 모델이 기권해도 다른 경로가 대신 답을 만들지 않습니다.",
];

/** 권위 경계 — 무엇을 모델이 제안하고 무엇을 프로그램이 정하는가. */
export const AUTHORITY_BOUNDARY = {
  model: [
    "사용자가 무엇을 의미했는지에 대한 후보",
    "조건 사이의 논리 구조 — 그리고 · 또는 · 아님",
    "시간·집합·상대 선택(상위 N% 같은 것)의 의미",
    "원문의 어느 구절이 근거인지",
    "모호하거나 확정할 수 없다는 판단",
  ],
  program: [
    "실제 표 · 컬럼 · 조인 · SQL · 파라미터",
    "어떤 물리 소스와 지표 구현을 쓸지",
    "집계와 윈도를 어떻게 계산할지",
    "빈 값(NULL) · 동점 · 소수 집단을 어떻게 다룰지",
    "카탈로그에 선언되지 않은 것은 쓰지 않는다는 규칙",
  ],
} as const;

/** 증명하지 못했을 때의 규칙. */
export const FAIL_CLOSE: readonly string[] = [
  "의미를 하나로 증명하지 못하면 비슷하게 맞는 SQL을 만들지 않고 멈춥니다.",
  "조건을 조용히 빼거나, 가장 비슷한 연산자로 바꾸거나, 기본값을 끼워 넣지 않습니다.",
  "멈춘 자리와 이유가 응답에 남습니다 — 다시 써서 열리는 것인지, 이 배포에 아직 선언이 없어 막힌 것인지를 구분해 알려 줍니다.",
];

/** 애니메이션에서 요청 표시가 지금 어디 있는지. */
export type StagePosition = {
  /** 머물고 있거나 막 떠난 단계의 번호. */
  readonly index: number;
  /** 0 이면 그 단계 위에 머무는 중, 0 초과면 다음 단계로 가는 중(1 이면 도착). */
  readonly travel: number;
};

/** 한 단계에 배정된 시간 중 머무는 비율. 나머지가 다음 단계로 가는 시간이다. */
const DWELL_SHARE = 0.55;

/**
 * 진행도(0~1)를 "몇 번째 단계에 있고 얼마나 이동했는가"로 바꾼다.
 *
 * 단계마다 같은 시간을 주고, 그 시간의 앞부분은 그 단계 위에 머문다 — 쉬지 않고 흐르면
 * 어느 단계를 읽어야 할지 알 수 없다. 마지막 단계는 갈 곳이 없으므로 이동하지 않는다.
 */
export function stageAtProgress(
  progress: number,
  stageCount: number,
): StagePosition {
  if (!Number.isFinite(stageCount) || stageCount < 1) {
    return { index: 0, travel: 0 };
  }
  const clamped = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  if (clamped >= 1) {
    return { index: stageCount - 1, travel: 0 };
  }
  const slot = 1 / stageCount;
  const index = Math.min(stageCount - 1, Math.floor(clamped / slot));
  if (index === stageCount - 1) {
    return { index, travel: 0 };
  }
  const within = (clamped - index * slot) / slot;
  const travel = within <= DWELL_SHARE ? 0 : (within - DWELL_SHARE) / (1 - DWELL_SHARE);
  return { index, travel };
}

/** 막히는 모드에서 요청이 더 나아가지 못하는 단계 번호. */
export function failCloseIndex(): number {
  return PIPELINE_STAGES.findIndex((stage) => stage.id === FAIL_CLOSE_STAGE_ID);
}

/** 모델을 부르는 단계 번호. */
export function llmStageIndex(): number {
  return PIPELINE_STAGES.findIndex((stage) => stage.id === LLM_STAGE_ID);
}
