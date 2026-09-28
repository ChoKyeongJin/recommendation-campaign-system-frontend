/**
 * 「조건은 어떻게 조립되나」 화면(`/admin/building-blocks`)의 선언.
 *
 * **무엇을 보여 주는가.** 조건 의미를 담는 계층(`event_ir`)은 문장 종류마다 타입을 늘리지 않는다.
 * 정해진 연산자 몇 개를 **조합**하고, 업무 개념(구매·로그인·환불)은 새 타입이 아니라 자료 블록의
 * **이름**이다. 이 화면은 그 규칙을 문장 하나가 블록으로 조립되는 과정으로 보여 준다.
 *
 * **읽는 사람은 개발자가 아니다.** 그래서 세 가지를 지킨다.
 *
 * 1. 블록 칸의 큰 글씨는 **이 자리에서 무슨 뜻인지**(`meaning`)이고, 블록 이름은 그 아래 작게
 *    붙는다. 블록 이름만 크게 적으면 읽는 사람이 그것을 매번 원래 문장으로 되돌려야 한다.
 * 2. 트리의 색은 블록 갈래가 아니라 **원래 문장의 어느 말에서 나왔는가**(`branch`)로 가른다.
 *    위에 띄운 문장의 색과 같으므로, 어느 말이 어느 가지가 됐는지 눈으로 이어진다.
 * 3. `event_ir` 의 실제 이름(`technical`)은 기본으로 숨긴다. 모든 칸에 영어가 붙어 있으면
 *    글자 수가 두 배가 되고 정작 뜻이 묻힌다. 찾는 사람은 토글로 켠다.
 *
 * **트리는 실제 모양이다.** 아래 노드는 예시 문장을 실제로 조립해 얻은 것이다 —
 * `event_ir.conjunction([Comparison(...), existence("purchase", negated=True, window=...)])` 가
 * 내는 `and / comparison / not / exists / filter / source / time_filter` 그대로다. 보기 좋으라고
 * 없는 노드를 넣거나 있는 노드를 지우지 않았다. 자리(x·y)만 읽기 좋게 손으로 잡았다.
 *
 * **줄인 것 한 가지.** 실제 `time_filter` 는 대상 필드(`purchase.occurred_at`)를 자식으로 들고
 * 있는데, 화면에서는 그 블록의 뜻 안에 적었다. 깊이가 한 단 더 내려가면 글자가 읽기 어려워지고,
 * 이 화면이 말하려는 것은 깊이가 아니라 **조합**이기 때문이다.
 *
 * **누가 고르는가도 이 화면의 것이다.** 조립만 보여 주면 읽는 사람은 "그럼 AI 가 이 블록들을
 * 고른 것인가" 를 스스로 메꾸고, 대개 그렇게 읽는다. 실제 경계는 그 반대다 — 모델은 **뜻 하나**를
 * 공표된 메뉴에서 고르고(`audience.value_equals`·`temporal.rolling_absence`), 그 뜻이 어떤 블록
 * 몇 개로 펼쳐지는지는 결정론 대응표(`semantic_candidate_lowering.LOWERING_RULES`)가 정한다.
 * 제출 계약(`SemanticIntentClaim`)에는 표·칸·조인·SQL·블록 이름을 적을 **칸 자체가 없다**.
 *
 * 그래서 단계마다 **행위자**(:data:`AssemblyStep.actor`)를 붙이고, 모델 단계에서 블록이 하나도
 * 늘지 않는 것을 테스트로 잰다. 「모델은 블록을 고르지 않는다」는 말은 그림이 그 단계에서 블록을
 * 내놓지 않을 때만 참이다.
 */

/** 그림이 따라가는 예시 요청. 「어떻게 동작하나」 화면과 같은 문장을 쓴다. */
export const EXAMPLE_REQUEST = "최근 3개월 동안 구매하지 않은 여성 고객을 찾아줘";

/** 트리의 가지 — 원래 문장의 어느 말에서 나왔는가. 색을 가르는 기준이다. */
export type Branch = "root" | "left" | "right";

/** 예시 문장을 가지별로 쪼갠 것. 이어 붙이면 `EXAMPLE_REQUEST` 와 같아야 한다. */
export const SENTENCE_PARTS: readonly {
  readonly text: string;
  /** `null` 은 조건이 아닌 부분(말투·군더더기). */
  readonly branch: Branch | null;
}[] = [
  { text: "최근 3개월 동안 구매하지 않은", branch: "right" },
  { text: " ", branch: null },
  { text: "여성", branch: "left" },
  { text: " 고객을 찾아줘", branch: null },
];

/** 블록의 갈래 — 블록 목록에서 색을 가르는 데 쓴다. */
export type BlockKind = "logic" | "value" | "relation" | "condition";

export type TreeNode = {
  readonly id: string;
  /** 부모 노드 id. 뿌리는 `null`. */
  readonly parent: string | null;
  /** 이 자리에서 무슨 뜻인지 — 칸의 큰 글씨. */
  readonly meaning: string;
  /** 블록 이름. 블록 목록의 이름과 같아야 한다. */
  readonly blockName: string;
  /** `event_ir` 의 실제 노드 이름. 토글을 켰을 때만 보인다. */
  readonly technical: string;
  readonly branch: Branch;
  /** 몇 번째 단계에서 나타나는가(1부터). */
  readonly step: number;
  readonly x: number;
  readonly y: number;
};

export const TREE_NODES: readonly TreeNode[] = [
  {
    id: "and",
    parent: null,
    meaning: "둘 다 맞아야 함",
    blockName: "그리고",
    technical: "and",
    branch: "root",
    step: 5,
    x: 500,
    y: 44,
  },
  {
    id: "comparison",
    parent: "and",
    meaning: "성별이 여성과 같은가",
    blockName: "비교",
    technical: "comparison (=)",
    branch: "left",
    step: 3,
    x: 250,
    y: 150,
  },
  {
    id: "field",
    parent: "comparison",
    meaning: "고객의 성별",
    blockName: "항목",
    technical: "field · customer.gender",
    branch: "left",
    step: 3,
    x: 140,
    y: 256,
  },
  {
    id: "literal",
    parent: "comparison",
    meaning: "여성",
    blockName: "값",
    technical: 'literal · "F"',
    branch: "left",
    step: 3,
    x: 350,
    y: 256,
  },
  {
    id: "not",
    parent: "and",
    meaning: "그렇지 않은 사람만",
    blockName: "아님",
    technical: "not",
    branch: "right",
    step: 4,
    x: 720,
    y: 150,
  },
  {
    id: "exists",
    parent: "not",
    meaning: "하나라도 있는가",
    blockName: "있나?",
    technical: "exists",
    branch: "right",
    step: 4,
    x: 720,
    y: 256,
  },
  {
    id: "filter",
    parent: "exists",
    meaning: "조건에 맞는 것만 남기기",
    blockName: "고르기",
    technical: "filter",
    branch: "right",
    step: 4,
    x: 720,
    y: 348,
  },
  {
    id: "source",
    parent: "filter",
    meaning: "구매 기록",
    blockName: "자료",
    technical: "source · purchase",
    branch: "right",
    step: 4,
    x: 600,
    y: 440,
  },
  {
    id: "time_filter",
    parent: "filter",
    meaning: "구매한 때가 최근 3개월 안",
    blockName: "기간",
    technical: "time_filter · rolling 3 month",
    branch: "right",
    step: 4,
    x: 848,
    y: 440,
  },
];

/**
 * 부재 순서가 딸린 가지. 이 가지의 블록이 나타나는 단계에서 번호 목록을 보여 준다.
 *
 * 단계 번호를 적지 않는 이유는 실측이다 — 단계를 하나 끼워 넣었을 때 손으로 적은 `3` 이
 * 그대로 남아 부재 순서가 엉뚱한 조각의 단계에 떴다. 번호는 :func:`branchStep` 으로 센다.
 */
export const ABSENCE_BRANCH: Branch = "right";

/** 둘째 조각을 만드는 순서 — :data:`ABSENCE_BRANCH` 가 조립되는 단계에서 번호로 보여 준다. */
export const ABSENCE_SEQUENCE: readonly {
  readonly text: string;
  readonly blockName: string;
}[] = [
  { text: "구매 기록을 가져옵니다", blockName: "자료" },
  { text: "그중 최근 3개월 것만 남깁니다", blockName: "기간 + 고르기" },
  { text: "하나라도 남았는지 봅니다", blockName: "있나?" },
  { text: "그 답을 뒤집습니다 — 하나도 없는 사람이 됩니다", blockName: "아님" },
];

/**
 * 한 단계를 누가 하는가.
 *
 * 이 화면에서 `ai` 는 **한 단계뿐**이고, 블록이 나타나는 단계는 전부 `program` 이다. 그것이
 * 이 시스템의 경계이고, 라벨을 붙이는 이유다 — 행위자를 안 적으면 읽는 사람이 조립 전체를
 * AI 가 한 것으로 읽는다.
 */
export type Actor = "ai" | "program";

/** 행위자 라벨과 한 줄 설명. 화면의 배지가 이것을 그대로 쓴다. */
export const ACTORS: Readonly<Record<Actor, { label: string; note: string }>> = {
  ai: {
    label: "AI",
    note: "무슨 뜻으로 한 말인지만 고릅니다",
  },
  program: {
    label: "정해진 규칙",
    note: "고른 뜻을 블록과 조회문으로 옮깁니다",
  },
};

export type AssemblyStep = {
  readonly title: string;
  readonly plain: string;
  /** 이 단계를 누가 하는가. */
  readonly actor: Actor;
  /** 그 단계까지 조립한 것을 말로 읽으면. 없으면 읽을 것이 아직 없다. */
  readonly readback?: string;
};

export const ASSEMBLY_STEPS: readonly AssemblyStep[] = [
  {
    title: "문장을 조각으로 나눕니다",
    plain:
      "조건이 되는 말만 골라냅니다. 「찾아줘」 같은 말투는 조건이 아니라서 빠집니다.",
    actor: "program",
  },
  {
    title: "AI가 조각마다 무슨 뜻인지 고릅니다",
    plain:
      "AI가 하는 일은 여기까지입니다. 고를 수 있는 뜻의 목록을 미리 받아서 그중에서 고르고, 문장의 어느 말을 보고 그렇게 골랐는지 그대로 인용합니다. 어떤 블록을 쓸지는 고르지 않습니다 — 적어 낼 칸조차 없습니다.",
    actor: "ai",
    readback: "「성별이 여성」 하나, 「최근 3개월 동안 구매가 없음」 하나. 이 둘을 「그리고」로 묶은 것",
  },
  {
    title: "「여성」을 블록 세 개로 만듭니다",
    plain:
      "AI가 고른 뜻은 「값이 같다」 하나입니다. 그 뜻에 짝지어진 규칙이 블록 셋을 냅니다 — 무엇을 볼지(고객의 성별), 무엇과 견줄지(여성), 어떻게 견줄지(같은가).",
    actor: "program",
    readback: "성별이 여성인 사람",
  },
  {
    title: "「구매하지 않은」도 있는 블록으로 만듭니다",
    plain:
      "여기서도 AI가 고른 뜻은 「최근 얼마 동안 그 일이 없었다」 하나입니다. 「구매하지 않았다」를 위한 전용 기능은 없고, 그 뜻에 짝지어진 규칙이 아래 네 단계를 순서대로 쌓습니다.",
    actor: "program",
    readback: "구매 기록 중에 최근 3개월 안의 것이 하나도 없는 사람",
  },
  {
    title: "두 덩어리를 하나로 묶습니다",
    plain:
      "「그리고」 블록이 둘을 묶습니다. 「그리고」인지 「또는」인지는 AI가 앞 단계에서 이미 고른 것이고, 여기서는 그대로 옮깁니다. 이제 조건 하나가 됐습니다.",
    actor: "program",
    readback:
      "성별이 여성이면서, 구매 기록 중에 최근 3개월 안의 것이 하나도 없는 사람",
  },
  {
    title: "이 조립을 그대로 조회문으로 옮깁니다",
    plain:
      "블록마다 어떤 표·칸을 쓸지는 배포 설정이 정합니다. 여기서 처음으로 실제 데이터 이름이 나오고, AI는 이 이름을 본 적이 없습니다.",
    actor: "program",
    readback:
      "성별이 여성이면서, 구매 기록 중에 최근 3개월 안의 것이 하나도 없는 사람",
  },
];

/**
 * AI 가 뜻을 고르는 단계에서 오가는 것.
 *
 * 왼쪽은 **요청마다 새로 만들어 보내는 메뉴**다(`SemanticCandidatePack`). 모델이 고를 수 있는
 * 것은 이 메뉴에 실린 것 전부이고, 메뉴에 없는 것을 적으면 참조가 맞지 않아 그 자리에서 닫힌다.
 * 오른쪽은 모델이 실제로 돌려주는 칸(`SemanticIntentClaim`)이다 — 뜻 이름, 이름표 참조, 값 참조,
 * 인용, 그리고 「헷갈린다」. 표·칸·조인·SQL·블록을 적을 칸은 이 계약에 없다.
 */
export const MODEL_EXCHANGE = {
  /** 모델에게 보내는 것. */
  sends: [
    {
      label: "고를 수 있는 뜻의 목록",
      detail:
        "「값이 같다」, 「최근 얼마 동안 그 일이 없었다」 같은 뜻의 이름과, 각 뜻이 몇 자리를 채워야 하는지",
      technical: "operator registry · 이름과 자리 수만",
    },
    {
      label: "이 문장에 쓸 만한 이름표",
      detail:
        "「고객 성별」, 「구매 기록」 같은 이름표. 이름표마다 임시 번호가 붙어 있고, 실제 표·칸 이름은 들어 있지 않습니다",
      technical: "candidate pack · {ref, role, label, surfaces}",
    },
    {
      label: "문장에서 찾아 둔 값",
      detail: "「3개월」, 「여성」처럼 앱이 미리 읽어 둔 값. 모델은 그 값을 가리키기만 합니다",
      technical: "literal refs",
    },
  ],
  /** 모델이 돌려주는 것. */
  returns: [
    {
      label: "고른 뜻",
      detail: "조각마다 위 목록에서 하나",
      technical: "operator",
    },
    {
      label: "고른 이름표와 값",
      detail: "번호로 가리킵니다",
      technical: "candidate_refs · literal_refs",
    },
    {
      label: "그렇게 고른 근거",
      detail: "문장의 어느 말을 보고 골랐는지 글자 그대로 인용",
      technical: "evidence_quotes",
    },
    {
      label: "묶는 방식",
      detail: "「그리고」인지 「또는」인지, 「아님」인지",
      technical: "logic.and · logic.or · logic.not",
    },
    {
      label: "헷갈리면 헷갈린다고",
      detail: "비슷한 이름표가 둘이라 못 고르겠으면 그렇게 답합니다. 찍지 않습니다",
      technical: "status · missing_slots",
    },
  ],
} as const;

/** 모델이 낼 수 없는 것 — 금지가 아니라 **적을 칸이 없음**이다. */
export const MODEL_CANNOT: readonly string[] = [
  "어느 표의 어느 칸에서 꺼낼지 — 메뉴에 실리지도 않고 적어 낼 칸도 없습니다",
  "어떤 블록을 쓸지 — 블록 이름을 적는 칸이 없습니다",
  "조회문, 조인, 계산 방법",
  "값이 비어 있을 때·점수가 같을 때의 처리 방법",
  "메뉴에 없던 이름표 — 지어내면 참조가 맞지 않아 닫힙니다",
];

/** 모델의 답을 받은 뒤 프로그램이 대조하는 것. 하나라도 어긋나면 멈춘다. */
export const PROGRAM_CHECKS: readonly string[] = [
  "인용한 말이 문장에 정말로 그 자리에 있는가 — 위치까지 다시 찾아 맞춰 봅니다",
  "고른 이름표와 값이 이번 요청 메뉴에 있던 것인가",
  "값의 단위와 범위가 미리 적어 둔 것과 맞는가 — 「3개월」을 3일로 읽지 않습니다",
  "「그리고 / 또는 / 아님」의 묶음이 문장과 같은 모양인가",
  "이 뜻을 이 데이터로 실제로 실행할 수 있는가",
];

/**
 * 뜻 하나가 어떤 블록으로 펼쳐지는가 — 이 화면의 핵심 대조표.
 *
 * 왼쪽은 모델이 고른 것이고 오른쪽은 대응표가 낸 것이다. 오른쪽이 왼쪽보다 **많다**는 점이
 * 이 표가 말하려는 전부다: 모델은 「구매하지 않았다」 하나를 골랐고, 블록 다섯 개를 고른 것이
 * 아니다. 여기 적힌 블록은 위 그림에 실제로 있는 것과 같아야 한다(테스트가 잰다).
 */
export const MEANING_TO_BLOCKS: readonly {
  /** 문장의 어느 조각인가. */
  readonly piece: string;
  /** 모델이 고른 뜻 — 쉬운 말로. */
  readonly meaning: string;
  /** 그 뜻의 실제 이름. 토글을 켰을 때만 보인다. */
  readonly technical: string;
  /** 대응표가 낸 블록. 블록 목록과 그림에 있는 이름이어야 한다. */
  readonly blocks: readonly string[];
  readonly branch: Branch;
}[] = [
  {
    piece: "여성",
    meaning: "값이 같다",
    technical: "audience.value_equals",
    blocks: ["비교", "항목", "값"],
    branch: "left",
  },
  {
    piece: "최근 3개월 동안 구매하지 않은",
    meaning: "최근 얼마 동안 그 일이 없었다",
    technical: "temporal.rolling_absence",
    blocks: ["아님", "있나?", "고르기", "자료", "기간"],
    branch: "right",
  },
  {
    piece: "두 조각을 한꺼번에 말했다",
    meaning: "둘 다 맞아야 한다",
    technical: "logic.and",
    blocks: ["그리고"],
    branch: "root",
  },
];

/**
 * 사슬 그림의 칸 — AI 가 이 사슬에서 **몇 번째 한 칸인지**를 눈으로 보여 준다.
 *
 * 글로 "AI 는 뜻만 고릅니다" 라고 적어도, 읽는 사람은 그 말이 사슬의 어디를 가리키는지 스스로
 * 세워야 한다. 칸을 그려 놓고 그중 하나만 색을 달리하면 그 셈이 필요 없어진다.
 *
 * 자리는 선언 순서에서 파생한다 — x·y 를 손으로 적지 않는다. 칸을 하나 끼워 넣어도 그림이
 * 알아서 늘어나고, 손으로 적은 좌표가 낙후되는 일이 없다.
 */
export const BOUNDARY_FLOW: readonly {
  readonly label: string;
  /** 그 칸이 무슨 일을 하는지 한 줄. 그림 안에 들어가므로 짧아야 한다. */
  readonly note: string;
  /** 누구의 칸인가. `user` 는 사용자가 쓴 것으로, 시스템이 하는 일이 아니다. */
  readonly lane: "user" | Actor;
  /** 토글을 켰을 때만 보이는 실제 이름. 사용자 칸에는 없다. */
  readonly technical: string | null;
}[] = [
  {
    label: "사용자가 쓴 문장",
    note: "그대로 넘어갑니다",
    lane: "user",
    technical: null,
  },
  {
    label: "고를 수 있는 뜻·이름표",
    note: "요청마다 새로 만듭니다",
    lane: "program",
    technical: "candidate pack",
  },
  {
    label: "AI가 뜻을 고릅니다",
    note: "조각마다 하나 + 근거 인용",
    lane: "ai",
    technical: "claim graph",
  },
  {
    label: "고른 것을 대조합니다",
    note: "어긋나면 여기서 멈춥니다",
    lane: "program",
    technical: "resolver",
  },
  {
    label: "블록으로 펼칩니다",
    note: "미리 적어 둔 대응표",
    lane: "program",
    technical: "lowering rules",
  },
  {
    label: "조회문",
    note: "표·칸 이름이 처음 나옵니다",
    lane: "program",
    technical: "compiler",
  },
];

/** 사슬 그림 아래 한 줄. */
export const BOUNDARY_FLOW_NOTE =
  "색이 다른 칸이 AI입니다. 앞 칸이 고를 수 있는 것을 정해 주고, 뒤 칸이 고른 것을 대조합니다.";

/** 대응표가 결정론이라는 사실을 한 줄로. */
export const MAPPING_NOTE =
  "같은 뜻을 고르면 언제나 같은 블록이 나옵니다. 뜻과 블록을 짝지은 표는 미리 적혀 있고, 요청마다 달라지지 않습니다.";

/** 메뉴에 없는 뜻을 만났을 때. */
export const OFF_MENU: readonly string[] = [
  "메뉴에 없는 뜻은 고를 수 없습니다. 비슷한 것을 골라 두는 자리가 없습니다.",
  "그래서 처음 보는 요청이 메뉴 밖이면 「지금은 표현할 수 없다」고 답합니다. 대충 비슷한 명단을 만들어 내보내지 않습니다.",
  "이름표가 둘 이상 겹쳐 못 고를 때는 되물어봅니다 — 그 선택지는 전부 실제로 실행할 수 있는 것들입니다.",
];

/** 마지막 단계에서 보여 주는 조회문 — 모양을 보여 주는 예시다. */
export const EXAMPLE_SQL = `SELECT 고객번호
FROM 고객
WHERE 성별 = :성별
  AND NOT EXISTS (
        SELECT 1
        FROM 구매기록
        WHERE 구매기록.고객번호 = 고객.고객번호
          AND 구매일시 >= :기준일
      )`;

export const EXAMPLE_SQL_NOTE =
  "모양을 보여 주는 예시입니다. 실제 표·칸 이름과 값은 배포 설정이 정하고, 값은 항상 따로 묶어 넣습니다.";

/** 블록 목록 한 갈래. */
export type BlockGroup = {
  readonly kind: BlockKind;
  readonly title: string;
  readonly blocks: readonly {
    readonly label: string;
    /** 이 블록이 무슨 일을 하는지 한마디로. */
    readonly does: string;
    readonly technical: string;
  }[];
};

export const BLOCK_GROUPS: readonly BlockGroup[] = [
  {
    kind: "logic",
    title: "묶는 블록",
    blocks: [
      { label: "그리고", does: "둘 다 맞아야 함", technical: "and" },
      { label: "또는", does: "둘 중 하나만 맞아도 됨", technical: "or" },
      { label: "아님", does: "답을 뒤집음", technical: "not" },
    ],
  },
  {
    kind: "value",
    title: "값을 다루는 블록",
    blocks: [
      { label: "값", does: "여성, 30, VIP 같은 값 하나", technical: "literal" },
      { label: "항목", does: "성별 칸, 구매금액 칸 같은 자리", technical: "field" },
      { label: "계산", does: "더하기·나누기 같은 셈", technical: "arithmetic" },
      { label: "묶음", does: "값 여러 개를 한 덩어리로", technical: "tuple" },
      { label: "빈 값 처리", does: "빈 칸을 어떻게 볼지", technical: "nullIf" },
      { label: "합계·개수", does: "여러 줄을 하나로 요약", technical: "aggregate" },
    ],
  },
  {
    kind: "relation",
    title: "자료를 다루는 블록",
    blocks: [
      { label: "자료", does: "구매 기록·로그인 기록 같은 자료", technical: "source" },
      { label: "고르기", does: "조건에 맞는 것만 남김", technical: "filter" },
      { label: "잇기", does: "두 자료를 이어 붙임", technical: "join" },
      { label: "묶기", does: "같은 것끼리 모음", technical: "group" },
      { label: "뽑기", does: "필요한 칸만 꺼냄", technical: "project" },
      { label: "요약", does: "묶은 것을 한 줄로", technical: "summarize" },
      { label: "정렬", does: "순서대로 세움", technical: "order" },
      { label: "잘라내기", does: "앞에서 몇 개만", technical: "limit" },
    ],
  },
  {
    kind: "condition",
    title: "따지는 블록과 기간",
    blocks: [
      { label: "비교", does: "같은가·큰가·작은가", technical: "comparison" },
      { label: "있나?", does: "하나라도 있는지", technical: "exists" },
      { label: "기간", does: "그 기간 안의 것만", technical: "timeFilter" },
      { label: "두 사건 사이", does: "이것 뒤 며칠 안에 저것", technical: "temporalRelation" },
      { label: "정해진 기간", does: "1월 1일부터 3월 31일까지", technical: "absoluteInterval" },
      { label: "최근 얼마", does: "최근 3개월, 지난 30일", technical: "rollingWindow" },
      { label: "지난달 같은 말", does: "지난달·지지난달·올해", technical: "relativeWindow" },
      { label: "얼마 동안", does: "7일, 3개월 같은 길이", technical: "duration" },
    ],
  },
];

/** 같은 블록으로 만들어지는 다른 문장들. */
export const OTHER_EXAMPLES: readonly {
  readonly sentence: string;
  readonly blocks: readonly string[];
}[] = [
  {
    sentence: "VIP 등급이면서 최근 30일 안에 로그인한 고객",
    blocks: ["그리고", "비교", "있나?", "기간"],
  },
  {
    sentence: "1월에는 샀지만 2월에는 사지 않은 고객",
    blocks: ["그리고", "있나?", "아님", "정해진 기간"],
  },
  {
    sentence: "가입하고 7일 안에 첫 구매를 한 고객",
    blocks: ["두 사건 사이", "얼마 동안", "자료"],
  },
  {
    sentence: "지난달 구매금액 상위 10% 고객",
    blocks: ["묶기", "합계·개수", "정렬", "잘라내기", "지난달 같은 말"],
  },
];

/** 만약 문장마다 기능을 만든다면 생겼을 것들 — 대조로 보여 준다. */
export const IF_WE_DID_IT_THE_OTHER_WAY: readonly string[] = [
  "「최근 3개월 구매 안 한 고객」 기능",
  "「최근 6개월 구매 안 한 고객」 기능",
  "「1월에 사고 2월에 안 산 고객」 기능",
  "「가입 7일 안에 재구매한 고객」 기능",
  "…끝이 없습니다",
];

/** 이 화면이 말하려는 것. */
export const WHY_IT_MATTERS: readonly string[] = [
  "블록을 조합하면 위 문장들이 전부 이미 있는 블록으로 만들어집니다. 새로 만들 것이 없습니다.",
  "그래서 처음 보는 문장도 답할 수 있고, 새 문장 때문에 이미 되던 것이 망가지지 않습니다.",
  "구매 · 로그인 · 환불 같은 업무 개념도 새 블록이 아니라 자료 블록의 이름입니다. 다룰 자료가 늘면 목록에 한 줄 더할 뿐입니다.",
  "있는 블록으로 표현할 수 없는 요청은 억지로 비슷하게 만들지 않고 「지금은 표현할 수 없다」고 답합니다.",
];

/** 기술 이름을 찾는 사람을 위한 한 줄. 화면 맨 아래에만 둔다. */
export const TECHNICAL_NOTE =
  "기술 메모 — 이 블록들은 event_ir 의 연산자이고, 그림의 트리는 예시 문장을 실제로 조립해 얻은 모양입니다. 모델이 고르는 것은 semantic_intent_candidate 의 claim graph(연산자 이름·후보 ref·리터럴 ref·인용)이고, 그 뜻을 블록으로 펼치는 것은 semantic_candidate_lowering.LOWERING_RULES 입니다. 블록에서 실제 표·컬럼으로의 연결은 레지스트리가 소유합니다.";

/** 그 단계까지 나타난 블록만. 단계는 1부터 센다. */
export function nodesUpTo(step: number): readonly TreeNode[] {
  return TREE_NODES.filter((node) => node.step <= step);
}

/**
 * 그 단계에서 그릴 수 있는 선 — 양쪽 블록이 **둘 다** 나타난 것만.
 *
 * 한쪽만 보일 때 선을 그리면 허공에 매달린 선이 생긴다.
 */
export function edgesUpTo(step: number): readonly { from: TreeNode; to: TreeNode }[] {
  const visible = new Map(nodesUpTo(step).map((node) => [node.id, node]));
  const edges: { from: TreeNode; to: TreeNode }[] = [];
  for (const node of visible.values()) {
    if (node.parent === null) continue;
    const parent = visible.get(node.parent);
    if (parent) edges.push({ from: parent, to: node });
  }
  return edges;
}

/** 이 단계에서 문장의 어느 조각이 이미 블록이 됐는가. */
export function assembledBranches(step: number): ReadonlySet<Branch> {
  return new Set(nodesUpTo(step).map((node) => node.branch));
}

/** 마지막 단계 번호. 이 단계에서 조회문이 나온다. */
export const LAST_STEP = ASSEMBLY_STEPS.length;

/**
 * 그 가지의 블록이 나타나는 단계 번호(1부터).
 *
 * 없는 가지를 물으면 `0` 이다 — 그 가지의 블록이 그림에 없다는 뜻이고, 어떤 단계와도 같지
 * 않으므로 그 가지에 매달린 설명은 아무 단계에도 뜨지 않는다.
 */
export function branchStep(branch: Branch): number {
  const steps = TREE_NODES.filter((node) => node.branch === branch).map((node) => node.step);
  return steps.length > 0 ? Math.min(...steps) : 0;
}

/**
 * AI 가 뜻을 고르는 단계 번호(1부터).
 *
 * 선언에서 **파생한다** — 단계를 하나 끼워 넣을 때 이 숫자를 손으로 고치는 일이 생기면
 * 화면이 엉뚱한 단계에서 모델 이야기를 하게 된다.
 */
export const MODEL_STEP: number =
  ASSEMBLY_STEPS.findIndex((step) => step.actor === "ai") + 1;
