import type { TargetingResult } from "./campaign-data.ts";

export type TargetingOutcome =
  | { kind: "success" }
  | { kind: "choice" }
  | { kind: "failure"; reason: string };

/** Presentation only: unresolved requests never become executable by hiding a form. */
export function targetingOutcome(result: TargetingResult): TargetingOutcome {
  const resolution = result.resolution;
  const questions = resolution?.questions ?? [];
  const canChoose = resolution?.status === "needs_clarification" &&
    questions.length > 0 && questions.every((question) =>
      question.options.length > 0 && question.options.every((option) =>
        option.id.trim() && option.label.trim() &&
        (question.answerShape !== "restatement" || option.query?.trim()),
      ),
    );
  if (canChoose) return { kind: "choice" };
  if (resolution?.status === "needs_clarification" && questions.length > 0) {
    const evidence = [...new Set(questions.map((question) => question.evidenceText?.trim()).filter(Boolean))];
    return { kind: "failure", reason: evidence.length
      ? `${evidence.map((text) => `‘${text}’`).join(", ")} 조건의 의미나 값을 확정하지 못했습니다.`
      : "요청에 필요한 조건의 의미나 값을 확정하지 못했습니다." };
  }
  if (result.failureStage || result.failureExplanation || (resolution && resolution.status !== "resolved")) {
    return { kind: "failure", reason: result.failureExplanation?.summary || result.message ||
      result.failureExplanation?.message || "요청을 처리하는 중 오류가 발생했습니다." };
  }
  const diagnostics = result.diagnostics;
  if (diagnostics?.droppedConditions.length || diagnostics?.droppedConditionLabels.length) {
    return { kind: "failure", reason: "요청한 조건을 모두 결과에 반영하지 못했습니다." };
  }
  if (diagnostics?.unsupportedConditions.length || diagnostics?.unsupportedConditionLabels.length) {
    return { kind: "failure", reason: "요청에 현재 실행할 수 없는 조건이 포함돼 있습니다." };
  }
  if (diagnostics?.missingInputConditions.length || diagnostics?.clarificationQuestions.length) {
    return { kind: "failure", reason: "요청에 필요한 조건의 의미나 값을 확정하지 못했습니다." };
  }
  if (diagnostics?.failureReason) {
    return { kind: "failure", reason: result.message || "요청을 처리하는 중 오류가 발생했습니다." };
  }
  return { kind: "success" };
}
