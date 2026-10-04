import assert from "node:assert/strict";
import test from "node:test";
import { targetingOutcome } from "./targeting-outcome.ts";
import type { ClarificationQuestion, TargetingResolution, TargetingResult } from "./campaign-data.ts";

const question: ClarificationQuestion = {
  questionId: "q", issueId: "i", code: "choice", text: "기준", slot: "criterion",
  options: [{ id: "count", label: "구매 횟수", query: "구매 횟수가 많은 고객" }],
  allowFreeText: true, answerShape: "restatement", evidenceText: "구매량",
};
const resolution: TargetingResolution = {
  status: "needs_clarification", resolution: "exact", mode: "strict",
  assumptions: [], alternatives: [], questions: [question],
};
const result = { resolution } as TargetingResult;

test("only complete selectable questions stay in confirmation", () => {
  assert.equal(targetingOutcome(result).kind, "choice");
});
test("free input and mixed questions are failures without re-entry advice", () => {
  for (const questions of [[{ ...question, options: [] }], [question, { ...question, options: [] }]]) {
    const outcome = targetingOutcome({ ...result, resolution: { ...resolution, questions } });
    assert.equal(outcome.kind, "failure");
    if (outcome.kind === "failure") {
      assert.match(outcome.reason, /구매량.*확정하지 못했습니다/);
      assert.doesNotMatch(outcome.reason, /입력해|다시|선택해/);
    }
  }
});
test("incomplete restatements cannot offer a broken choice", () => {
  assert.equal(targetingOutcome({ ...result, resolution: { ...resolution,
    questions: [{ ...question, options: [{ id: "x", label: "보기" }] }] } }).kind, "failure");
});
test("unsupported and system failures display the backend reason", () => {
  const failed = { ...result, resolution: { ...resolution, status: "unsupported" as const },
    message: "검색 시스템에 연결하지 못했습니다." };
  assert.deepEqual(targetingOutcome(failed), { kind: "failure", reason: failed.message });
});
test("a resolved request remains successful", () => {
  assert.equal(targetingOutcome({ ...result, resolution: { ...resolution, status: "resolved", questions: [] } }).kind, "success");
});

test("legacy re-entry diagnostics also fail without a question form", () => {
  assert.equal(targetingOutcome({ ...result, resolution: undefined, diagnostics: {
    unsupportedConditions: [], unsupportedConditionLabels: [], droppedConditions: [],
    droppedConditionLabels: [], missingInputConditions: ["audience.period"], clarificationQuestions: [],
  } }).kind, "failure");
});
test("an empty successful audience is still a valid result", () => {
  assert.equal(targetingOutcome({ ...result, total: 0,
    resolution: { ...resolution, status: "resolved", questions: [] } }).kind, "success");
});
