/**
 * 새 DB 를 이 시스템에 붙일 때의 세팅 순서 — 화면 상단 안내 카드가 읽는 정본.
 *
 * **왜 화면에 두는가.** 순서 자체는 백엔드 저장소의 런북(`docs/operations/db_swap_runbook.md`)이
 * 소유한다. 그런데 세팅을 하는 사람은 런북을 열기 전에 이 화면부터 연다 — 요청이 막혔을 때
 * "무엇을 더 적어야 하는지"를 묻는 자리가 여기이기 때문이다. 그래서 순서를 화면 상단에 한 번
 * 더 적되, **명령과 자리 이름만** 옮기고 판정·문구는 옮기지 않는다.
 *
 * **무엇을 옮기지 않는가.** 지금 배포가 어디까지 채워졌는지는 여기서 말하지 않는다. 그 사실은
 * `db_swap_preflight.py` 의 재고와 요청 실패 응답(`profile_axis_undeclared` 가 적는 선언 자리)이
 * 소유한다. 화면이 같은 판정을 한 벌 더 들고 있으면 한쪽만 바뀌었을 때 두 답이 갈린다.
 */

/** 명령문 안에서 프로필 이름이 들어갈 자리. */
export const PROFILE_PLACEHOLDER = "<이름>";

/** 입력이 비었을 때 예시로 보여 주는 이름(현재 배포 프로필). */
export const EXAMPLE_PROFILE_NAME = "mss_ontology";

/** 접었는지 여부를 기억하는 자리 — 매일 쓰는 사람이 한 번 접으면 계속 접혀 있다. */
export const SETUP_GUIDE_STORAGE_KEY = "campaign-setup-guide-collapsed";

/**
 * 셸에 그대로 붙여 넣을 명령을 만들므로, 치환은 **이 모양의 이름만** 받는다.
 * 공백·따옴표·세미콜론이 섞인 입력을 그대로 끼워 넣으면 복사한 명령이 다른 일을 한다.
 */
const SAFE_PROFILE_NAME = /^[A-Za-z0-9_-]+$/;

export type SetupStepKind = "machine" | "human";

/** 사람이 직접 적어야 하는 한 자리. */
export type SetupFillIn = {
  /** 어느 파일의 어느 자리인가. */
  readonly where: string;
  /** 무엇을 적는가. */
  readonly what: string;
  /** 왜 그렇게 적는가, 안 적으면 어떻게 되는가. */
  readonly detail: string;
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
      "미리 정해 둘 것 두 가지 — 고객 표 이름과, 고객 한 명을 구분하는 키 컬럼 이름.",
    ],
    fillIns: [],
  },
  {
    id: "scaffold",
    title: "프로필 뼈대를 만듭니다",
    lead: "설정 파일 한 벌이 빈 선언으로 생깁니다. 명령 한 줄이면 끝납니다.",
    kind: "machine",
    commands: [
      `python tools/profile_scaffold.py --profile ${PROFILE_PLACEHOLDER} --driver pymysql --subject-table <고객표> --subject-key <고객키>`,
    ],
    notes: [
      "--driver 는 psycopg(PostgreSQL) · pymysql(MySQL·MariaDB) · pymssql(SQL Server) 중 하나입니다.",
      "<고객표> · <고객키> 는 1단계에서 정해 둔 이름으로 바꿉니다.",
      "앞으로 모든 명령에 --profile 을 줍니다. 파일 경로를 하나씩 손으로 지정하면 설정이 섞여 기동이 막힙니다.",
      "만들어진 폴더의 README.md 에 이 프로필에서 채울 자리가 다시 적혀 있습니다.",
    ],
    fillIns: [],
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
  },
  {
    id: "declare",
    title: "사람이 채우는 네 자리",
    lead: "손으로 적는 곳은 여기뿐입니다. 축 하나(예: 성별)를 여는 데 대략 26항목이 듭니다.",
    kind: "human",
    commands: [],
    notes: [],
    fillIns: [
      {
        where: "member_target_filters.json — UNDECLARED__ 표지 두 개",
        what: "나이 컬럼(base_entity.age_column)과 활성 회원 조건(active_state)",
        detail:
          "실제 컬럼·값으로 바꿉니다. 그 축을 안 쓸 거면 _supported: false 로 닫습니다.",
      },
      {
        where: "audience_catalog.json — 필드의 뜻",
        what: "라벨 · 별칭 · 허용 연산자 · 값 도메인",
        detail:
          "쓸 필드만 채우면 됩니다. 안 채운 필드는 실행에서 자동으로 빠지므로 그대로 둬도 안전합니다.",
      },
      {
        where: "member_target_filters.json — eq_filters 값 사전",
        what: "값마다 canonical · category · column · value · synonyms",
        detail:
          "DB 에 실제로 들어 있는 값을 빠짐없이 적습니다(UNKNOWN 같은 것도). 하나만 빠져도 점검에서 막힙니다.",
      },
      {
        where: "audience_catalog.json — signal_coverage.<축>",
        what: "성별 · 장바구니 · 최근 접속 · 구매 부재 · 수신동의 · 캠페인 반응 4종",
        detail:
          "이 시스템이 알아듣는 9개 축 중 쓸 것을 선언합니다. 안 쓰는 축은 expressible: false 로 닫습니다. 비워 두면 그 축의 요청이 '아직 선언되지 않았습니다'로 닫힙니다.",
      },
    ],
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
  },
];

/** 세팅 중 자주 걸리는 자리 — 단계가 아니라 "막혔을 때" 읽는 줄이다. */
export const SETUP_TROUBLESHOOTING: readonly string[] = [
  "고칠 자리는 한 번에 하나씩 드러납니다. 한 번에 다 나오지 않아도 정상입니다.",
  "요청이 막히면 결과 화면이 어느 축이 아직 선언되지 않았는지와 적을 자리를 함께 알려 줍니다.",
  "등급·지역·연령대처럼 이 시스템이 자동으로 가리지 못하는 축은 자리를 알려 주지 않습니다. 그때는 카탈로그를 직접 봅니다.",
];

/**
 * 명령문의 프로필 자리를 사용자가 적은 이름으로 바꾼다.
 *
 * 이름이 비었거나 셸에 그대로 넣기 어려운 모양이면 **바꾸지 않고** 자리 표시를 남긴다 —
 * 반쯤 채워진 명령을 복사해 가는 것보다, 아직 고칠 자리가 남았다고 보이는 편이 낫다.
 */
export function applyProfileName(command: string, profileName: string): string {
  const name = profileName.trim();
  if (!name || !SAFE_PROFILE_NAME.test(name)) {
    return command;
  }
  // split/join 으로 바꾼다 — 자리 표시에 정규식 특수문자가 들어 있다.
  return command.split(PROFILE_PLACEHOLDER).join(name);
}

/** 사용자가 적은 이름을 명령에 끼워 넣을 수 있는가(입력 옆 안내 문구가 읽는다). */
export function isUsableProfileName(profileName: string): boolean {
  const name = profileName.trim();
  return name.length > 0 && SAFE_PROFILE_NAME.test(name);
}
