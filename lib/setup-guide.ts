/**
 * 새 DB 를 이 시스템에 붙일 때의 세팅 순서 — 화면 상단 안내 카드가 읽는 정본.
 *
 * **왜 화면에 두는가.** 순서 자체는 백엔드 저장소의 런북(`docs/operations/db_swap_runbook.md`)이
 * 소유한다. 그런데 세팅을 하는 사람은 런북을 열기 전에 이 앱부터 연다 — 요청이 막혔을 때
 * "무엇을 더 적어야 하는지"를 묻는 자리가 여기이기 때문이다. 그래서 설정 메뉴가 여는 전용
 * 화면(`/admin/setup`)에 순서를 한 번 더 적되, **명령과 자리 이름만** 옮기고 판정·문구는
 * 옮기지 않는다. 매일 타겟을 뽑는 화면에는 두지 않는다 — 거기서 읽을 내용이 아니다.
 *
 * **무엇을 옮기지 않는가.** 지금 배포가 어디까지 채워졌는지는 여기서 말하지 않는다. 그 사실은
 * `db_swap_preflight.py` 의 재고와 요청 실패 응답(`profile_axis_undeclared` 가 적는 선언 자리)이
 * 소유한다. 화면이 같은 판정을 한 벌 더 들고 있으면 한쪽만 바뀌었을 때 두 답이 갈린다.
 */

/** 명령문 안에서 프로필 이름이 들어갈 자리. */
export const PROFILE_PLACEHOLDER = "<이름>";

/** 명령문에서 고객 표·고객 키가 들어갈 자리. 설명 칸과 명령문이 같은 글자를 써야 이어진다. */
export const SUBJECT_TABLE_PLACEHOLDER = "<고객표>";
export const SUBJECT_KEY_PLACEHOLDER = "<고객키>";

/** 입력이 비었을 때 예시로 보여 주는 이름(현재 배포 프로필). */
export const EXAMPLE_PROFILE_NAME = "mss_ontology";

/**
 * 셸에 그대로 붙여 넣을 명령을 만들므로, 치환은 **이 모양의 값만** 받는다.
 * 공백·따옴표·세미콜론이 섞인 입력을 그대로 끼워 넣으면 복사한 명령이 다른 일을 한다.
 *
 * 프로필과 식별자는 **모양이 다르다.** 프로필 이름은 붙임표를 받지만(`shop-2026`),
 * 표·컬럼 이름은 뒤쪽 도구가 `plain identifier` 로 거절한다 — 화면에서 받아 두고 도구에서
 * 막히면 사용자는 어디가 틀렸는지 모른 채 명령만 붙들게 된다.
 */
const VALUE_SHAPES = {
  profile: /^[A-Za-z0-9_-]+$/,
  subjectTable: /^[A-Za-z0-9_]+$/,
  subjectKey: /^[A-Za-z0-9_]+$/,
} as const;

/** 명령문에 사용자가 직접 채우는 자리. */
export type SetupValueId = keyof typeof VALUE_SHAPES;

/** 화면 위 입력칸 한 줄의 선언. */
export type SetupInput = {
  readonly id: SetupValueId;
  /** 명령문에 나오는 자리 표시 그대로. */
  readonly placeholder: string;
  readonly label: string;
  /** 비었을 때 입력칸에 흐리게 보여 줄 예시. */
  readonly example: string;
  /** 받을 수 있는 글자를 사람 말로. 모양이 틀렸을 때 이 줄을 보여 준다. */
  readonly shape: string;
};

export type SetupValues = Readonly<Partial<Record<SetupValueId, string>>>;

/** 이 배열이 곧 화면의 입력칸이다. 자리 표시를 늘리면 여기에 한 줄 더한다. */
export const SETUP_INPUTS: readonly SetupInput[] = [
  {
    id: "profile",
    placeholder: PROFILE_PLACEHOLDER,
    label: "프로필 이름",
    example: EXAMPLE_PROFILE_NAME,
    shape: "영문·숫자·밑줄·붙임표",
  },
  {
    id: "subjectTable",
    placeholder: SUBJECT_TABLE_PLACEHOLDER,
    label: "고객 테이블",
    example: "cust_profile",
    shape: "영문·숫자·밑줄",
  },
  {
    id: "subjectKey",
    placeholder: SUBJECT_KEY_PLACEHOLDER,
    label: "고객 구분 컬럼",
    example: "customer_id",
    shape: "영문·숫자·밑줄",
  },
];

export type SetupStepKind = "machine" | "human";

/** 사람이 직접 적어야 하는 한 자리. */
export type SetupFillIn = {
  /**
   * 눌러서 열어 보는 선언 파일. 참조 API 의 `profile` 범주 이름이고, 그 범주는 **지금 배포가
   * 실제로 읽는** 파일을 돌려준다 — 같은 이름의 은퇴한 사본이 아니다.
   */
  readonly file: string;
  /** 그 파일 안의 어느 자리인가. */
  readonly where: string;
  /** 무엇을 적는가. */
  readonly what: string;
  /** 왜 그렇게 적는가, 안 적으면 어떻게 되는가. */
  readonly detail: string;
};

/**
 * 명령문의 자리 표시 하나를 **무엇으로 바꾸는가**.
 *
 * `fillIn` 과 다른 칸이다. `fillIn` 은 선언 파일의 어느 자리를 채우는지이고, 이것은 셸에
 * 붙여 넣기 전에 **사람이 먼저 정해야 하는 값**이다. 둘을 한 칸에 담으면 "파일을 열어
 * 채운다" 와 "명령에 직접 적는다" 가 같은 모양으로 보인다.
 *
 * 자리 표시만 적어 두고 뜻을 안 적으면, 읽는 사람이 `<고객표>` 를 보고 무엇을 넣을지
 * 스스로 고른다. 실제로 그랬다 — 화면은 "1단계에서 정해 둔 이름" 이라고만 했고, 무엇을
 * 고르는 것인지는 어디에도 없었다.
 */
export type SetupDecision = {
  /** 명령문에 나오는 자리 표시 그대로. 화면에서 명령과 눈으로 이어진다. */
  readonly placeholder: string;
  /** 한마디로 무엇인가. */
  readonly title: string;
  /** 쉬운 말로 한 줄. */
  readonly plain: string;
  /** 고를 때의 기준 — 이것이 아니라 저것. */
  readonly pick: readonly string[];
  /** 지금 배포는 무엇을 넣었는가. 고르는 사람이 모양을 볼 수 있어야 한다. */
  readonly example: string;
};

export type SetupStep = {
  readonly id: string;
  readonly title: string;
  /** 이 단계가 무엇을 끝내는지 한 줄. */
  readonly lead: string;
  /** `machine` 은 명령만 실행하면 되는 단계, `human` 은 사람의 판단이 필요한 단계다. */
  readonly kind: SetupStepKind;
  readonly commands: readonly string[];
  readonly notes: readonly string[];
  readonly fillIns: readonly SetupFillIn[];
  /** 명령에 직접 적을 값 가운데 사람이 먼저 정해야 하는 것. */
  readonly decisions: readonly SetupDecision[];
};



export const SETUP_STEPS: readonly SetupStep[] = [
  {
    id: "connection",
    title: "접속 정보를 .env 에 적습니다",
    lead: "서버가 어느 DB 를 볼지 정합니다. 읽기 전용 계정을 씁니다.",
    kind: "human",
    commands: [],
    notes: [
      "<접두사>_DB_HOST · _PORT · _NAME · _USER · _PASSWORD 다섯 개를 적습니다. 접두사 이름은 다음 단계가 만들어 알려 줍니다.",
      "주소와 비밀번호는 .env 에만 둡니다. 저장소 파일에는 환경변수 이름만 남습니다.",
      "아래 두 가지는 화면 맨 위 입력칸에 적으면 다음 단계 명령에 그대로 들어갑니다. 지금 DB 를 보면서 정해 두세요.",
    ],
    fillIns: [],
    decisions: [
      {
        placeholder: SUBJECT_TABLE_PLACEHOLDER,
        title: "고객 테이블 이름",
        plain:
          "고객 한 명이 한 줄인 표입니다. 성별 · 나이 · 등급처럼 그 사람의 정보가 들어 있는 표를 찾으면 됩니다.",
        pick: [
          "구매 기록 · 로그인 기록처럼 한 사람이 여러 줄인 표는 아닙니다. 그런 표를 넣으면 이후 모든 조건이 사람 단위가 아니라 줄 단위가 됩니다.",
          "표 이름만 적습니다. 「스키마.표」처럼 점을 찍으면 도구가 받지 않습니다.",
        ],
        example: "지금 배포는 cust_profile 입니다.",
      },
      {
        placeholder: SUBJECT_KEY_PLACEHOLDER,
        title: "고객 구분 컬럼 이름",
        plain:
          "그 표에서 고객 한 명 한 명을 구분하는 컬럼 하나입니다. 회원번호 같은 것.",
        pick: [
          "구매 · 로그인 기록에서 「이 줄은 누구 것인가」를 가리킬 때 쓰는 바로 그 컬럼이어야 합니다. 그래야 사람과 기록이 이어집니다.",
          "컬럼 하나만 적습니다. 두 컬럼을 합쳐 쓰는 키는 받지 않습니다.",
        ],
        example:
          "지금 배포는 customer_id 입니다. 구매 · 로그인 등 아홉 개 표가 모두 이 컬럼으로 같은 사람을 가리킵니다.",
      },
    ],
  },
  {
    id: "scaffold",
    title: "프로필 뼈대를 만듭니다",
    lead: "설정 파일 한 벌이 빈 선언으로 생깁니다. 명령 한 줄이면 끝납니다.",
    kind: "machine",
    commands: [
      `python tools/profile_scaffold.py --profile ${PROFILE_PLACEHOLDER} --driver pymysql --subject-table ${SUBJECT_TABLE_PLACEHOLDER} --subject-key ${SUBJECT_KEY_PLACEHOLDER}`,
    ],
    notes: [
      "--driver 는 psycopg(PostgreSQL) · pymysql(MySQL·MariaDB) · pymssql(SQL Server) 중 하나입니다.",
      `${SUBJECT_TABLE_PLACEHOLDER} · ${SUBJECT_KEY_PLACEHOLDER} 는 1단계에서 정해 둔 이름으로 바꿉니다. 이름을 잘못 적으면 마지막 점검이 「카탈로그에 없는 컬럼」으로 지목합니다 — 실DB 에 접속하지 않아도 걸립니다.`,
      "앞으로 모든 명령에 --profile 을 줍니다. 파일 경로를 하나씩 손으로 지정하면 설정이 섞여 기동이 막힙니다.",
      "만들어진 폴더의 README.md 에 이 프로필에서 채울 자리가 다시 적혀 있습니다.",
    ],
    fillIns: [],
    decisions: [],
  },
  {
    id: "introspect",
    title: "실제 DB 를 읽어 초안을 만듭니다",
    lead: "표·컬럼·타입처럼 DB 가 이미 아는 것은 도구가 읽어 옵니다.",
    kind: "machine",
    commands: [
      `python schema_extract.py --profile ${PROFILE_PLACEHOLDER} --refresh-external --connection ${PROFILE_PLACEHOLDER}`,
      `python tools/audience_catalog_draft.py --profile ${PROFILE_PLACEHOLDER} --report`,
    ],
    notes: [
      "라벨·별칭 같은 '뜻'은 비워 둡니다 — 컬럼 이름으로 의미를 추측하지 않습니다. 그 자리가 다음 단계입니다.",
      "--report 가 아직 비어 있는 자리를 한 화면에 열거합니다.",
    ],
    fillIns: [],
    decisions: [],
  },
  {
    id: "declare",
    title: "사람이 채우는 네 자리",
    lead:
      "손으로 적는 곳은 여기뿐입니다. 축 하나(예: 성별)를 여는 데 대략 26항목이 듭니다. 파일 이름을 누르면 지금 배포가 읽고 있는 내용을 그대로 볼 수 있습니다.",
    kind: "human",
    commands: [],
    notes: [],
    fillIns: [
      {
        file: "member_target_filters.json",
        where: "UNDECLARED__ 표지 두 개",
        what: "나이 컬럼(base_entity.age_column)과 활성 회원 조건(active_state)",
        detail:
          "실제 컬럼·값으로 바꿉니다. 그 축을 안 쓸 거면 _supported: false 로 닫습니다.",
      },
      {
        file: "audience_catalog.json",
        where: "필드의 뜻",
        what: "라벨 · 별칭 · 허용 연산자 · 값 도메인",
        detail:
          "쓸 필드만 채우면 됩니다. 안 채운 필드는 실행에서 자동으로 빠지므로 그대로 둬도 안전합니다.",
      },
      {
        file: "member_target_filters.json",
        where: "eq_filters 값 사전",
        what: "값마다 canonical · category · column · value · synonyms",
        detail:
          "DB 에 실제로 들어 있는 값을 빠짐없이 적습니다(UNKNOWN 같은 것도). 하나만 빠져도 점검에서 막힙니다.",
      },
      {
        file: "audience_catalog.json",
        where: "signal_coverage.<축>",
        what: "성별 · 장바구니 · 최근 접속 · 구매 부재 · 수신동의 · 캠페인 반응 4종",
        detail:
          "이 시스템이 알아듣는 9개 축 중 쓸 것을 선언합니다. 안 쓰는 축은 expressible: false 로 닫습니다. 비워 두면 그 축의 요청이 '아직 선언되지 않았습니다'로 닫힙니다.",
      },
    ],
    decisions: [],
  },
  {
    id: "verify",
    title: "점검하고 띄웁니다",
    lead: "점검이 초록이 되기 전에는 배포하지 않습니다.",
    kind: "machine",
    commands: [
      `python build_member_value_index.py --profile ${PROFILE_PLACEHOLDER}`,
      `python build_dimension_catalog.py --profile ${PROFILE_PLACEHOLDER}`,
      "python db_swap_preflight.py",
      "python db_swap_preflight.py --check-db",
    ],
    notes: [
      "❌ 는 반드시 고쳐야 하는 것이고, ℹ️ [onboarding] 줄은 아직 안 채운 자리 목록입니다(실패가 아닙니다).",
      "초록이 되면 이 화면에 요청을 하나 넣어 결과까지 확인합니다.",
    ],
    fillIns: [],
    decisions: [],
  },
];

/** 세팅 중 자주 걸리는 자리 — 단계가 아니라 "막혔을 때" 읽는 줄이다. */
export const SETUP_TROUBLESHOOTING: readonly string[] = [
  "고칠 자리는 한 번에 하나씩 드러납니다. 한 번에 다 나오지 않아도 정상입니다.",
  "요청이 막히면 결과 화면이 어느 축이 아직 선언되지 않았는지와 적을 자리를 함께 알려 줍니다.",
  "등급·지역·연령대처럼 이 시스템이 자동으로 가리지 못하는 축은 자리를 알려 주지 않습니다. 그때는 카탈로그를 직접 봅니다.",
];

/** 사용자가 적은 값을 명령에 끼워 넣을 수 있는가(입력 옆 안내 문구가 읽는다). */
export function isUsableValue(id: SetupValueId, value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && VALUE_SHAPES[id].test(trimmed);
}

/**
 * 명령문의 자리 표시를 사용자가 적은 값으로 바꾼다.
 *
 * 값이 비었거나 셸에 그대로 넣기 어려운 모양이면 그 자리만 **바꾸지 않고** 남긴다 —
 * 반쯤 채워진 명령을 복사해 가는 것보다, 아직 고칠 자리가 남았다고 보이는 편이 낫다.
 * 한 자리가 비어도 나머지 자리는 채운다: 셋을 한꺼번에 알아야 하는 것이 아니다.
 */
export function applySetupValues(command: string, values: SetupValues): string {
  let filled = command;
  for (const input of SETUP_INPUTS) {
    const value = (values[input.id] ?? "").trim();
    if (!isUsableValue(input.id, value)) continue;
    // split/join 으로 바꾼다 — 자리 표시에 정규식 특수문자가 들어 있다.
    filled = filled.split(input.placeholder).join(value);
  }
  return filled;
}

/** 프로필 자리만 바꾼다. :func:`applySetupValues` 의 한 자리 껍데기다. */
export function applyProfileName(command: string, profileName: string): string {
  return applySetupValues(command, { profile: profileName });
}

/** 프로필 이름을 명령에 끼워 넣을 수 있는가. */
export function isUsableProfileName(profileName: string): boolean {
  return isUsableValue("profile", profileName);
}
