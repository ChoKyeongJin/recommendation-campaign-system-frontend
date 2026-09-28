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
    step: 4,
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
    step: 2,
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
    step: 2,
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
    step: 2,
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
    step: 3,
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
    step: 3,
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
    step: 3,
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
    step: 3,
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
    step: 3,
    x: 848,
    y: 440,
  },
];

/** 둘째 조각을 만드는 순서 — 3단계에서 번호로 보여 준다. */
export const ABSENCE_SEQUENCE: readonly {
  readonly text: string;
  readonly blockName: string;
}[] = [
  { text: "구매 기록을 가져옵니다", blockName: "자료" },
  { text: "그중 최근 3개월 것만 남깁니다", blockName: "기간 + 고르기" },
  { text: "하나라도 남았는지 봅니다", blockName: "있나?" },
  { text: "그 답을 뒤집습니다 — 하나도 없는 사람이 됩니다", blockName: "아님" },
];

export type AssemblyStep = {
  readonly title: string;
  readonly plain: string;
  /** 그 단계까지 조립한 것을 말로 읽으면. 없으면 읽을 것이 아직 없다. */
  readonly readback?: string;
};

export const ASSEMBLY_STEPS: readonly AssemblyStep[] = [
  {
    title: "문장을 조각으로 나눕니다",
    plain:
      "조건이 되는 말만 골라냅니다. 「찾아줘」 같은 말투는 조건이 아니라서 빠집니다.",
  },
  {
    title: "「여성」을 블록 세 개로 만듭니다",
    plain:
      "무엇을 볼지(고객의 성별), 무엇과 견줄지(여성), 어떻게 견줄지(같은가). 세 블록이면 끝입니다.",
    readback: "성별이 여성인 사람",
  },
  {
    title: "「구매하지 않은」도 있는 블록으로 만듭니다",
    plain:
      "「구매하지 않았다」를 위한 전용 기능은 없습니다. 아래 네 단계를 순서대로 쌓으면 같은 뜻이 됩니다.",
    readback: "구매 기록 중에 최근 3개월 안의 것이 하나도 없는 사람",
  },
  {
    title: "두 덩어리를 하나로 묶습니다",
    plain: "「그리고」 블록이 둘을 묶습니다. 이제 조건 하나가 됐습니다.",
    readback:
      "성별이 여성이면서, 구매 기록 중에 최근 3개월 안의 것이 하나도 없는 사람",
  },
  {
    title: "이 조립을 그대로 조회문으로 옮깁니다",
    plain:
      "블록마다 어떤 표·칸을 쓸지는 배포 설정이 정합니다. 여기서 처음으로 실제 데이터 이름이 나옵니다.",
    readback:
      "성별이 여성이면서, 구매 기록 중에 최근 3개월 안의 것이 하나도 없는 사람",
  },
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
  "기술 메모 — 이 블록들은 event_ir 의 연산자이고, 그림의 트리는 예시 문장을 실제로 조립해 얻은 모양입니다. 블록에서 실제 표·컬럼으로의 연결은 레지스트리가 소유합니다.";

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
