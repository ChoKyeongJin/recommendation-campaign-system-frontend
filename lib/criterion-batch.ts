import type { ClarificationAnswer, ClarificationQuestion } from "./campaign-data.ts";

export type CriterionBatchResult =
  | { kind: "rewrite"; query: string; deferredAnswerCount: 0 }
  | { kind: "invalid"; message: string };

/** Only server-issued insertions into one original request can be combined. */
export function canBatchCriteria(questions: ClarificationQuestion[]): boolean {
  const source = questions[0]?.criterionInput?.sourceQuery;
  return typeof source === "string" && source.trim().length > 0 && questions.length > 0
    && new Set(questions.map((question) => question.issueId)).size === questions.length
    && questions.every((question) => {
      const input = question.criterionInput;
      const offset = input?.insertionOffset;
      return question.presentation === "criterion_choice" && question.answerShape === "restatement"
        && input?.sourceQuery === source && typeof offset === "number"
        && Number.isInteger(offset) && offset >= 0 && offset <= Array.from(source).length;
    });
}

export function buildCriterionBatch(
  questions: ClarificationQuestion[], answers: ClarificationAnswer[],
): CriterionBatchResult {
  if (!canBatchCriteria(questions)) {
    return { kind: "invalid", message: "선택한 기준의 원문이 일치하지 않아 함께 적용할 수 없습니다." };
  }
  const byIssue = new Map(answers.map((answer) => [answer.issueId, answer]));
  if (answers.length !== questions.length || byIssue.size !== answers.length) {
    return { kind: "invalid", message: "모든 기준을 하나씩 선택해 주세요." };
  }
  const source = questions[0].criterionInput!.sourceQuery!;
  const points = Array.from(source);
  const insertions = new Map<number, string[]>();
  for (const question of questions) {
    const answer = byIssue.get(question.issueId);
    const option = question.options.find((item) => item.id === answer?.optionId);
    const input = question.criterionInput!;
    const offset = input.insertionOffset!;
    const prefix = points.slice(0, offset).join("");
    const suffix = points.slice(offset).join("");
    const query = option?.query;
    if (!answer?.optionId || answer.text || typeof query !== "string"
        || !query.startsWith(prefix) || !query.endsWith(suffix)
        || query.length <= source.length
        || !query.startsWith(input.prefix) || !query.endsWith(input.suffix)) {
      return { kind: "invalid", message: "선택한 기준이 원래 조건을 보존하지 않아 적용할 수 없습니다." };
    }
    const text = query.slice(prefix.length, query.length - suffix.length);
    const atOffset = insertions.get(offset) ?? [];
    atOffset.push(text);
    insertions.set(offset, atOffset);
  }
  // Apply each edit at its original code point position, never inside another
  // selection. Labels and sentence meaning play no part in composition.
  let query = "";
  for (let offset = 0; offset <= points.length; offset += 1) {
    query += (insertions.get(offset) ?? []).join("") + (points[offset] ?? "");
  }
  return { kind: "rewrite", query, deferredAnswerCount: 0 };
}
