export type PromptCatalogEntry = {
  role: string;
  variables: string[];
};

/**
 * 타겟팅 프롬프트의 역할과 사용 가능한 템플릿 변수.
 * 본문에서 변수는 `${변수명}` 형식으로 사용한다.
 * 상세 화면의 변수 도우미 패널과 저장 전 `${...}` 검증에 사용한다.
 */
export const PROMPT_CATALOG: Record<string, PromptCatalogEntry> = {
  "query_plan_system.txt": {
    role: "Query Plan 생성 역할, canonical 값 제한, 부정 조건 처리",
    variables: [],
  },
  "query_plan_user.txt": {
    role: "질문·허용값·fallback plan을 묶는 템플릿",
    variables: ["query", "allowed_values", "fallback_plan"],
  },
  "answer_system.txt": {
    role: "검증된 SQL만 사용하도록 답변 역할 제한",
    variables: [],
  },
  "answer_user.txt": {
    role: "Query Plan·Context·SQL 결과로 답변 입력 구성",
    variables: ["query", "query_plan", "context", "sql_result", "sql_policy"],
  },
};

export function getCatalogEntry(name: string): PromptCatalogEntry | null {
  return PROMPT_CATALOG[name] ?? null;
}

/** 본문에서 `${변수명}` 토큰을 추출한다. */
export function extractTemplateVariables(content: string): string[] {
  const matches = content.matchAll(/\$\{\s*([a-zA-Z0-9_]+)\s*\}/g);
  const seen = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      seen.add(match[1]);
    }
  }
  return [...seen];
}

/** 카탈로그에 정의되지 않은(오타 가능성 있는) 변수를 찾는다. */
export function findUndefinedVariables(
  name: string,
  content: string,
): string[] {
  const entry = getCatalogEntry(name);
  const allowed = new Set(entry?.variables ?? []);
  // 카탈로그가 없는(신규) 프롬프트는 검증하지 않는다.
  if (!entry) {
    return [];
  }
  return extractTemplateVariables(content).filter(
    (variable) => !allowed.has(variable),
  );
}
