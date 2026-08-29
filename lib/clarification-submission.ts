import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "./campaign-data.ts";

export type ClarificationSubmission =
  | { kind: "answers"; answers: ClarificationAnswer[] }
  | { kind: "rewrite"; query: string; deferredAnswerCount: number }
  | { kind: "invalid"; message: string };

/**
 * 되묻기 입력을 백엔드 계약에 맞는 다음 동작으로 바꾼다.
 *
 * `slot_fill`은 기존처럼 issue_id에 답을 결속한다. `restatement`는 슬롯 적용기가 없는 질문이므로
 * clarification_answers로 보내지 않고, 백엔드가 제공했거나 사용자가 다시 쓴 완성 문장을
 * 새 프롬프트로 실행한다.
 * 재작성 문장이 없거나 재작성 선택이 둘 이상이면 추측하지 않고 즉시 실패한다.
 */
export function buildClarificationSubmission(
  questions: ClarificationQuestion[],
  answers: ClarificationAnswer[],
): ClarificationSubmission {
  const questionByIssueId = new Map(
    questions.map((question) => [question.issueId, question]),
  );
  const rewriteSelections = answers.flatMap((answer) => {
    const question = questionByIssueId.get(answer.issueId);
    if (question?.answerShape !== "restatement") {
      return [];
    }
    const option = question.options.find(
      (candidate) => candidate.id === answer.optionId,
    );
    const query = answer.optionId
      ? option?.query?.trim()
      : answer.text?.trim();
    return [{ query }];
  });

  if (rewriteSelections.length === 0) {
    return { kind: "answers", answers };
  }
  if (rewriteSelections.length > 1) {
    return {
      kind: "invalid",
      message: "문장으로 다시 적용할 조건은 한 번에 하나씩 선택해 주세요.",
    };
  }

  const query = rewriteSelections[0]?.query;
  if (!query) {
    return {
      kind: "invalid",
      message: "선택한 조건에 다시 실행할 요청 문장이 없어 적용할 수 없습니다.",
    };
  }

  return {
    kind: "rewrite",
    query,
    // 재작성으로 프롬프트가 바뀌면 이전 issue_id 답을 함께 보내지 않는다. 다음 라운드에서 다시 묻는다.
    deferredAnswerCount: Math.max(0, answers.length - 1),
  };
}
