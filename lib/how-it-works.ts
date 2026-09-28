/**
 * 「어떻게 동작하나」 화면(`/admin/how-it-works`)이 그리는 파이프라인 선언.
 *
 * **독자는 개발자가 아니다.** 이 화면은 캠페인을 만드는 사람이 "내가 쓴 문장이 어떻게 고객 명단이
 * 되는가" 를 읽는 자리다. 그래서 문구는 쉬운 말로 쓰고, 단계마다 예시 요청 하나가 실제로 어떻게
 * 되는지를 함께 적는다(:data:`EXAMPLE_REQUEST`). 기술 이름은 화면 맨 아래 한 줄로만 남긴다 —
 * 지우면 무엇을 그린 그림인지 확인할 길이 없어지고, 앞에 두면 읽던 사람이 멈춘다.
 *
 * **이 화면이 그리는 배포.** 의미 해석을 `llm_primary` 모드로만 도는 배포다. 그 모드가 켜지면
 * 종결 사슬은 그 한 단에서 끝난다 — 확정이든 기권이든 미지원이든 오류든 전부 그 단이 닫고,
 * 뒤의 결정론 사슬로 새지 않는다. 그래서 provider 호출 자리가 하나로 그려진다. 다른 모드에서는
 * 호출 자리가 더 많고, 그때는 이 그림이 그 배포를 말하지 않는다.
 *
 * **단계 라벨은 백엔드가 소유한다**(`target_sql_progress._METADATA`). 여기 적힌 것은 그 라벨의
 * 사본이다 — 목록을 주는 엔드포인트가 없어 설명 화면은 사본을 들 수밖에 없다. 쉬운 설명과 예시는
 * 이 화면의 것이다. 백엔드에서 라벨을 고치면 여기도 같은 작업에서 고친다.
 *
 * **판정은 옮기지 않는다.** 지금 어떤 모드로 돌고 있는지, 이번 요청이 몇 번 호출했는지는 이
 * 화면이 말하지 않는다. 그것은 진행 스트림의 `llm_call` 이벤트가 요청마다 실제로 나르는 사실이고,
 * 타겟 추출 화면이 이미 그 자리에서 보여 준다.
 */

/** 그림 전체를 따라가는 예시 요청. 실제로 이 시스템에 넣을 수 있는 문장이어야 한다. */
export const EXAMPLE_REQUEST = "최근 3개월 동안 구매하지 않은 여성 고객을 찾아줘";

/** 파이프라인 한 단계. `id` 는 백엔드 `ProgressStage` 값과 같다. */
export type PipelineStage = {
  readonly id: string;
  /** 백엔드가 진행 이벤트에 싣는 라벨. 타겟을 뽑는 동안 화면에 뜨는 그 이름이다. */
  readonly label: string;
  /** 이 단계가 무슨 일을 하는지 쉬운 말로. */
  readonly plain: string;
  /** 예시 요청이 이 단계에서 실제로 어떻게 되는지. */
  readonly example: string;
};

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    id: "request_analysis",
    label: "요청 분석",
    plain: "문장을 정리합니다. 조건이 몇 개인지, 어디까지가 고객을 고르는 조건인지 나눕니다.",
    example:
      "「여성 고객」과 「최근 3개월 동안 구매하지 않은」, 두 가지를 말했다고 갈라 둡니다. 각각이 무슨 뜻인지는 아직 정하지 않습니다.",
  },
  {
    id: "semantic_resolution",
    label: "의미 해석",
    plain:
      "무슨 뜻으로 한 말인지 AI에게 한 번 물어봅니다. AI의 답은 아직 '의견'이고, 미리 정해 둔 규칙에 맞는지 확인을 통과해야 실행됩니다.",
    example:
      "AI가 「성별이 여성인 사람」과 「3개월 안에 주문이 한 번도 없는 사람」이라고 답합니다. 문장의 어느 부분을 보고 그렇게 판단했는지도 함께 냅니다.",
  },
  {
    id: "knowledge_retrieval",
    label: "관련 정보 검색",
    plain:
      "그 뜻이 우리 고객 데이터의 어디에 들어 있는지 찾습니다. 미리 적어 둔 설명서 안에서만 찾습니다.",
    example:
      "「성별」은 고객 정보의 성별 칸에서, 「구매」는 주문 기록에서 찾습니다. 이름이 비슷하다고 아무 칸이나 가져다 쓰지 않습니다.",
  },
  {
    id: "sql_compilation",
    label: "SQL 생성 및 검증",
    plain:
      "실제로 데이터를 꺼내 올 조회문을 만들고, 말한 조건이 빠짐없이 들어갔는지 검사합니다.",
    example:
      "「성별이 여성」과 「최근 3개월 주문 없음」이 둘 다 조회문에 들어갔는지 확인합니다. 하나라도 빠지면 내보내지 않습니다.",
  },
  {
    id: "database_execution",
    label: "대상 조회",
    plain: "만들어진 조회문으로 실제 고객을 찾아옵니다. 읽기만 하고 데이터를 바꾸지 않습니다.",
    example: "여성이면서 최근 3개월 동안 주문이 없는 고객만 남습니다.",
  },
  {
    id: "audience_materialization",
    label: "대상 저장",
    plain: "찾은 고객 명단을 캠페인에서 다시 쓸 수 있게 저장합니다.",
    example: "이 명단이 어떤 요청으로 만들어졌는지도 함께 남아서, 나중에 왜 이 사람들이 뽑혔는지 볼 수 있습니다.",
  },
];

/** AI에게 묻는 단계. 이 배포에서는 한 자리뿐이다. */
export const LLM_STAGE_ID = "semantic_resolution";

/** 뜻이 확실하지 않을 때 멈추는 단계 — 뒤 단계는 아예 돌지 않는다. */
export const FAIL_CLOSE_STAGE_ID = "semantic_resolution";

/** AI에게 한 번 묻고 받을 때 오가는 것. */
export const LLM_EXCHANGE = {
  /** 그림 안 상자에 적는 제목. */
  title: "AI에게 묻는 곳",
  /** 그 아래 한 줄. */
  subtitle: "요청 하나에 딱 한 번",
  /** AI에게 보내는 것. */
  sends: [
    "사용자가 쓴 문장 그대로",
    "이 시스템이 알아들을 수 있는 조건 목록 — 식당 메뉴판 같은 것입니다",
    "답을 어떤 형식으로 달라는 안내",
  ],
  /** AI가 돌려주는 것. */
  returns: [
    "무슨 뜻으로 한 말인지",
    "문장의 어느 부분을 보고 그렇게 판단했는지",
    "헷갈리면 헷갈린다고 — 지어내지 않습니다",
  ],
} as const;

/** AI에게 몇 번 묻는가. 숫자를 흐리지 않는다. */
export const CALL_BUDGET: readonly string[] = [
  "요청 한 번에 AI에게 묻는 것도 한 번입니다.",
  "AI가 「이 부분을 보고 그렇게 판단했다」고 짚은 곳이 문장에 실제로 없으면, 한 번만 더 물어보도록 켤 수 있습니다. 기본은 꺼져 있습니다.",
  "조회문을 만들다 실패해도 AI에게 다시 묻지 않습니다. 실패는 '지금은 못 한다'는 답이지, 다시 물어볼 이유가 아닙니다.",
  "AI가 모르겠다고 하면 거기서 끝납니다. 다른 방법으로 몰래 답을 만들어 내지 않습니다.",
];

/** 누가 무엇을 맡는가. */
export const AUTHORITY_BOUNDARY = {
  model: [
    "사용자가 무슨 뜻으로 말했는지 알아듣기",
    "조건을 '그리고'로 묶었는지 '또는'인지, 아니라는 뜻인지 가리기",
    "'최근', '상위 10%' 같은 말이 무엇을 뜻하는지",
    "문장의 어느 부분이 그 판단의 근거인지 짚기",
    "헷갈리면 헷갈린다고 말하기",
  ],
  program: [
    "어느 표의 어느 칸에서 데이터를 꺼낼지",
    "합계·평균·순위를 어떤 방법으로 계산할지",
    "값이 비어 있거나 점수가 같을 때 어떻게 다룰지",
    "실제 조회문을 만드는 일",
    "미리 적어 두지 않은 데이터는 쓰지 않기",
  ],
} as const;

/** 확실하지 않을 때의 규칙. */
export const FAIL_CLOSE: readonly string[] = [
  "뜻이 하나로 확실해지지 않으면, 대충 비슷한 결과를 내놓지 않고 멈춥니다.",
  "조건을 슬쩍 빼거나, 비슷한 다른 조건으로 바꾸거나, 임의로 기본값을 넣지 않습니다.",
  "멈추면 어디서 왜 멈췄는지 알려 줍니다 — 문장을 바꾸면 되는 것인지, 데이터 설정이 더 필요한 것인지 구분해서 말해 줍니다.",
];

/** 기술 이름을 찾는 사람을 위한 한 줄. 화면 맨 아래에만 둔다. */
export const TECHNICAL_NOTE =
  "기술 메모 — 이 그림은 의미 해석을 llm_primary 모드로만 도는 배포입니다. 단계 이름은 타겟을 뽑는 동안 진행 화면에 뜨는 것과 같습니다.";

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

/** AI에게 묻는 단계 번호. */
export function llmStageIndex(): number {
  return PIPELINE_STAGES.findIndex((stage) => stage.id === LLM_STAGE_ID);
}
