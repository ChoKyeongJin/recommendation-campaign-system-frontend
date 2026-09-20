import type { TargetingSupportLimit } from "./campaign-data.ts";

/**
 * `user_explanation.support_limit` → 화면이 읽는 지원 한계 카드(없으면 `null`).
 *
 * **켜고 끄는 판단은 백엔드가 이미 했다.** 여기서 `failure_type` 으로 다시 분기하지 않는다 —
 * 같은 규칙을 두 곳에 두면 한쪽만 바뀌었을 때 되묻기·DB 장애·내부 오류에도 "문장을 바꿀
 * 필요 없다"가 나간다. 그 실패들은 사용자가 다시 시도하거나 값을 채우면 열리는 자리다.
 *
 * 문구도 다시 쓰지 않는다. 백엔드가 만든 완성 문장을 그대로 옮기고, 필수 문장(제목·다음
 * 행동)이 비어 있으면 카드를 통째로 만들지 않는다 — 반쯤 빈 카드는 "무엇이 막혔는지"를
 * 말해 주지 못하면서 화면만 차지한다.
 *
 * 이 경로는 BFF(`app/api/targeting/route.ts`)의 응답 변환에서 부른다.
 */
export function mapSupportLimit(raw: unknown): TargetingSupportLimit | null {
  const record = asRecord(raw);
  // 백엔드는 한계가 아닌 실패에 이 블록 자체를 만들지 않는다. 플래그를 한 번 더 확인하는
  // 이유는 키만 남고 값이 비는 중간 상태(구버전·부분 응답)를 카드로 만들지 않기 위해서다.
  if (!record || record.show_unavoidable_explanation !== true) {
    return null;
  }

  const title = text(record.title);
  const nextAction = text(record.next_action);
  if (!title || !nextAction) {
    return null;
  }

  return {
    title,
    understood: text(record.understood),
    reason: text(record.reason),
    blockedConditions: list(record.blocked_conditions).flatMap((item) => {
      const row = asRecord(item);
      const conditionText = text(row?.text);
      const reason = text(row?.reason);
      // 구절만 있고 이유가 없으면 화면은 "이건 안 됩니다"의 다른 표기가 된다. 둘 다 있을
      // 때만 한 줄로 만든다.
      return conditionText && reason
        ? [{ text: conditionText, reason }]
        : [];
    }),
    // 값이 빠진 응답에서 "고칠 수 있다"로 넘어가지 않도록 명시적으로 비교한다.
    userCanFix: record.user_can_fix === true,
    nextAction,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}
