/**
 * 「조건은 어떻게 조립되나」 화면(`/admin/building-blocks`)의 선언.
 *
 * **무엇을 보여 주는가.** 조건 의미를 담는 계층(`event_ir`)은 문장 종류마다 타입을 늘리지 않는다.
 * 정해진 연산자 몇 개를 **조합**하고, 업무 개념(구매·로그인·환불)은 새 타입이 아니라 자료 블록의
 * **이름**이다. 이 화면은 그 규칙을 문장 하나가 블록으로 조립되는 과정으로 보여 준다.
 *
 * **트리는 실제 모양이다.** 아래 노드는 예시 문장을 실제로 조립해 얻은 것이다 —
 * `event_ir.conjunction([Comparison(...), existence("purchase", negated=True, window=...)])` 가
 * 내는 `and / comparison / not / exists / filter / source / time_filter` 그대로다. 보기 좋으라고
 * 없는 노드를 넣거나 있는 노드를 지우지 않았다. 자리(x·y)만 읽기 좋게 손으로 잡았다.
 *
 * **줄인 것 한 가지.** 실제 `time_filter` 는 대상 필드(`purchase.occurred_at`)를 자식으로 들고
 * 있는데, 화면에서는 그 블록의 설명 줄로 적었다. 깊이가 한 단 더 내려가면 글자가 읽기 어려워지고,
 * 이 화면이 말하려는 것은 깊이가 아니라 **조합**이기 때문이다.
 */

/** 그림이 따라가는 예시 요청. 「어떻게 동작하나」 화면과 같은 문장을 쓴다. */
export const EXAMPLE_REQUEST = "최근 3개월 동안 구매하지 않은 여성 고객을 찾아줘";

/** 블록의 갈래 — 색을 가르는 데 쓴다. */
export type BlockKind = "logic" | "value" | "relation" | "condition";

export type TreeNode = {
  readonly id: string;
  /** 부모 노드 id. 뿌리는 `null`. */
  readonly parent: string | null;
  /** 블록 이름을 쉬운 말로. */
  readonly label: string;
  /** 이 자리에서 무엇을 뜻하는지 한 줄. */
  readonly detail: string;
  /** `event_ir` 의 실제 노드 이름. 기술 이름을 찾는 사람을 위해 작게 적는다. */
  readonly technical: string;
  readonly kind: BlockKind;
  /** 몇 번째 단계에서 나타나는가(1부터). */
  readonly step: number;
  readonly x: number;
  readonly y: number;
};

export const TREE_NODES: readonly TreeNode[] = [
  {
    id: "and",
    parent: null,
    label: "그리고",
    detail: "두 조건을 모두 만족하는 사람만",
    technical: "and",
    kind: "logic",
    step: 4,
    x: 500,
    y: 44,
  },
  {
    id: "comparison",
    parent: "and",
    label: "비교",
    detail: "왼쪽이 오른쪽과 같은가",
    technical: "comparison (=)",
    kind: "condition",
    step: 2,
    x: 250,
    y: 148,
  },
  {
    id: "field",
    parent: "comparison",
    label: "항목",
    detail: "고객의 성별 칸",
    technical: "field · customer.gender",
    kind: "value",
    step: 2,
    x: 140,
    y: 252,
  },
  {
    id: "literal",
    parent: "comparison",
    label: "값",
    detail: "여성",
    technical: "literal · \"F\"",
    kind: "value",
    step: 2,
    x: 350,
    y: 252,
  },
  {
    id: "not",
    parent: "and",
    label: "아님",
    detail: "아래가 사실이 아닌 사람만",
    technical: "not",
    kind: "logic",
    step: 3,
    x: 720,
    y: 148,
  },
  {
    id: "exists",
    parent: "not",
    label: "있나?",
    detail: "해당하는 기록이 하나라도 있는가",
    technical: "exists",
    kind: "condition",
    step: 3,
    x: 720,
    y: 252,
  },
  {
    id: "filter",
    parent: "exists",
    label: "고르기",
    detail: "그중 조건에 맞는 것만 남긴다",
    technical: "filter",
    kind: "relation",
    step: 3,
    x: 720,
    y: 340,
  },
  {
    id: "source",
    parent: "filter",
    label: "자료",
    detail: "구매 기록",
    technical: "source · purchase",
    kind: "relation",
    step: 3,
    x: 605,
    y: 428,
  },
  {
    id: "time_filter",
    parent: "filter",
    label: "기간",
    detail: "구매 일시가 최근 3개월 안",
    technical: "time_filter · rolling 3 month",
    kind: "condition",
    step: 3,
    x: 845,
    y: 428,
  },
];

/** 조립 단계. 1부터 시작하고, 마지막 단계에서 조회문이 나온다. */
export type AssemblyStep = {
  readonly title: string;
  readonly plain: string;
};

export const ASSEMBLY_STEPS: readonly AssemblyStep[] = [
  {
    title: "문장을 조각으로 나눕니다",
    plain:
      "「여성 고객」과 「최근 3개월 동안 구매하지 않은」. 조각 하나가 조건 하나가 됩니다.",
  },
  {
    title: "첫 조각을 블록으로 바꿉니다",
    plain:
      "「여성」은 값 블록, 「성별」은 항목 블록, 둘을 비교 블록이 잇습니다. 세 블록이면 끝입니다.",
  },
  {
    title: "둘째 조각도 있는 블록으로 만듭니다",
    plain:
      "「구매하지 않았다」를 위한 전용 기능은 없습니다. 구매 기록을 골라(고르기) 최근 3개월로 좁히고(기간) 하나라도 있는지 묻고(있나?) 그 답을 뒤집습니다(아님).",
  },
  {
    title: "두 덩어리를 묶습니다",
    plain: "「그리고」 블록이 둘을 묶습니다. 이제 조건 하나가 됐습니다.",
  },
  {
    title: "이 조립을 조회문으로 옮깁니다",
    plain:
      "블록마다 어떤 표·칸을 쓸지는 배포 설정이 정합니다. 여기서 처음으로 실제 데이터 이름이 등장합니다.",
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
  readonly blocks: readonly { readonly label: string; readonly technical: string }[];
};

export const BLOCK_GROUPS: readonly BlockGroup[] = [
  {
    kind: "logic",
    title: "묶는 블록",
    blocks: [
      { label: "그리고", technical: "and" },
      { label: "또는", technical: "or" },
      { label: "아님", technical: "not" },
    ],
  },
  {
    kind: "value",
    title: "값을 다루는 블록",
    blocks: [
      { label: "값", technical: "literal" },
      { label: "항목", technical: "field" },
      { label: "계산", technical: "arithmetic" },
      { label: "묶음", technical: "tuple" },
      { label: "빈 값 처리", technical: "nullIf" },
      { label: "합계·개수", technical: "aggregate" },
    ],
  },
  {
    kind: "relation",
    title: "자료를 다루는 블록",
    blocks: [
      { label: "자료", technical: "source" },
      { label: "고르기", technical: "filter" },
      { label: "잇기", technical: "join" },
      { label: "묶기", technical: "group" },
      { label: "뽑기", technical: "project" },
      { label: "요약", technical: "summarize" },
      { label: "정렬", technical: "order" },
      { label: "잘라내기", technical: "limit" },
    ],
  },
  {
    kind: "condition",
    title: "따지는 블록과 기간",
    blocks: [
      { label: "비교", technical: "comparison" },
      { label: "있나?", technical: "exists" },
      { label: "기간", technical: "timeFilter" },
      { label: "두 사건 사이", technical: "temporalRelation" },
      { label: "정해진 기간", technical: "absoluteInterval" },
      { label: "최근 얼마", technical: "rollingWindow" },
      { label: "지난달 같은 말", technical: "relativeWindow" },
      { label: "얼마 동안", technical: "duration" },
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

/** 이 화면이 말하려는 것. */
export const WHY_IT_MATTERS: readonly string[] = [
  "문장 종류마다 기능을 새로 만들지 않습니다. 「구매하지 않았다」를 위한 전용 기능이 없는 것이 그 예입니다 — 있는 블록 네 개를 조합했을 뿐입니다.",
  "그래서 처음 보는 문장도 블록 조합으로 답할 수 있고, 새 문장 때문에 이미 되던 것이 망가지지 않습니다.",
  "구매 · 로그인 · 환불 같은 업무 개념은 새 블록이 아니라 자료 블록의 이름입니다. 다룰 자료가 늘면 목록에 한 줄 더할 뿐, 블록은 그대로입니다.",
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

/** 마지막 단계 번호. 이 단계에서 조회문이 나온다. */
export const LAST_STEP = ASSEMBLY_STEPS.length;
