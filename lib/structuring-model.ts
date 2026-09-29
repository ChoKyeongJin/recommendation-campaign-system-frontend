/**
 * 요청마다 고르는 **구조화 모델** — 화면이 읽는 자리.
 *
 * **왜 화면에 두는가.** 예전에는 모델을 바꾸려면 `.env` 를 고치고 api 컨테이너를 재생성해야
 * 했다. 그런데 백엔드는 호출마다 env 를 읽으므로, 재생성이 필요한 쪽은 코드가 아니라 파일이다.
 * 이제 요청이 모델을 실어 보내고, 백엔드가 그 요청 동안만 덮어쓴다 — 재생성도, 서버에 남는
 * 전역 상태도 없다. 한 사람이 5.4 로 재는 동안 다른 사람의 요청은 그대로 배포 기본값이다.
 *
 * **목록은 여기 적지 않는다.** 고를 수 있는 모델은 배포 선언
 * (`OPENAI_STRUCTURING_MODEL_CHOICES`)이 소유하고 `GET /api/structuring-models` 로 온다.
 * 화면이 같은 목록을 한 벌 더 들면, 배포가 바뀐 날 화면만 옛 이름을 보여 주고 그 요청은
 * 400 으로 죽는다.
 */

/** 배포가 알려 준 것. 목록이 비면 고르는 칸을 띄우지 않는다. */
export type StructuringModelChoices = {
  /** 고를 수 있는 모델. 선언 순서 그대로다. */
  readonly choices: readonly string[];
  /** 아무것도 안 골랐을 때 쓰이는 모델. 목록 밖일 수 있다. */
  readonly fallback: string | null;
};

export const NO_STRUCTURING_MODEL_CHOICES: StructuringModelChoices = {
  choices: [],
  fallback: null,
};

/** 화면에서 "안 고름" 을 나타내는 값. 빈 문자열은 `<select>` 가 그대로 쓸 수 있다. */
export const DEFAULT_MODEL_OPTION = "";

/**
 * `GET /api/structuring-models` 의 응답을 화면이 쓰는 모양으로 읽는다.
 *
 * 모르는 모양이면 **빈 목록**이다. 화면은 그때 고르는 칸을 감추고 요청은 배포 기본값으로
 * 그냥 나간다 — 목록을 못 읽었다고 타겟 추출이 막히면 안 된다.
 */
export function readStructuringModelChoices(
  payload: unknown,
): StructuringModelChoices {
  if (typeof payload !== "object" || payload === null) {
    return NO_STRUCTURING_MODEL_CHOICES;
  }
  const record = payload as Record<string, unknown>;
  const raw = Array.isArray(record.choices) ? record.choices : [];
  const seen: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (name && !seen.includes(name)) seen.push(name);
  }
  const fallback =
    typeof record.default === "string" && record.default.trim()
      ? record.default.trim()
      : null;
  return { choices: seen, fallback };
}

/**
 * 요청에 실어 보낼 값.
 *
 * 고르지 않았거나 목록 밖이면 `null` 이다 — 보내지 않는다는 뜻이고, 배포 기본값이 그대로
 * 산다. 목록 밖을 걸러 내는 이유는 방어가 아니라 **화면이 낡았을 때**다: 배포가 선언을 줄인
 * 뒤에도 브라우저에 남아 있던 선택이 그대로 나가면 요청이 400 으로 죽는다.
 */
export function chosenStructuringModel(
  selected: string,
  available: StructuringModelChoices,
): string | null {
  const name = selected.trim();
  if (!name) return null;
  return available.choices.includes(name) ? name : null;
}

/** 고르는 칸을 띄울 것인가. 고를 것이 하나뿐이어도 띄운다 — 기본값과 다를 수 있다. */
export function shouldOfferChoice(available: StructuringModelChoices): boolean {
  return available.choices.length > 0;
}

/** 칸 옆에 붙는 한 줄. 지금 무엇으로 나가는지를 말한다. */
export function describeChoice(
  selected: string,
  available: StructuringModelChoices,
): string {
  const chosen = chosenStructuringModel(selected, available);
  if (chosen) return `이 요청만 ${chosen} 로 해석합니다.`;
  if (available.fallback) {
    return `배포 기본값(${available.fallback})으로 해석합니다.`;
  }
  return "배포 기본값으로 해석합니다.";
}
