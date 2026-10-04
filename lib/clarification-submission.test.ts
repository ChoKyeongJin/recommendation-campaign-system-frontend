import assert from "node:assert/strict";
import test from "node:test";

import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "./campaign-data.ts";
import { buildClarificationSubmission } from "./clarification-submission.ts";
import { buildCriterionBatch, canBatchCriteria } from "./criterion-batch.ts";

function question(
  overrides: Partial<ClarificationQuestion> = {},
): ClarificationQuestion {
  return {
    questionId: "q-ranking",
    issueId: "ranking-issue",
    code: "MISSING_RANKING_QUOTA",
    text: "몇 명 또는 몇 %를 선택할지 정해 주세요.",
    slot: "ranking.quota",
    options: [],
    allowFreeText: true,
    answerShape: "slot_fill",
    ...overrides,
  };
}

function criterion(source: string, evidence: string, id: string, label: string, value: string): ClarificationQuestion {
  const end = source.indexOf(evidence) + evidence.length;
  const offset = Array.from(source.slice(0, end)).length;
  const prefix = source.slice(0, end) + ` (${label}: `;
  const suffix = ")" + source.slice(end);
  return question({
    questionId: `q-${id}`, issueId: id, slot: `audience.criterion.${id}`,
    answerShape: "restatement", presentation: "criterion_choice", allowFreeText: false,
    criterionInput: { prefix, suffix, sourceQuery: source, insertionOffset: offset },
    options: [{ id: "option", label: value, query: prefix + value + suffix }],
  });
}

test("기준 여러 개를 한 번에 적용하며 원문 기간과 다른 조건을 보존한다", () => {
  const source = "2026년 구매금액이 많은 고객 중 서울 고객";
  const evidence = "2026년 구매금액이 많은";
  const questions = [criterion(source, evidence, "comparison", "비교 방향", "이상"),
    criterion(source, evidence, "value", "수치 기준", "10000원")];
  assert.equal(canBatchCriteria(questions), true);
  const result = buildClarificationSubmission(questions,
    questions.map((q) => ({ issueId: q.issueId, optionId: "option" })));
  assert.deepEqual(result, { kind: "rewrite", deferredAnswerCount: 0,
    query: "2026년 구매금액이 많은 (비교 방향: 이상) (수치 기준: 10000원) 고객 중 서울 고객" });
});

test("다른 절과 Unicode 좌표를 보존하고 선택 순서로 조건 위치가 바뀌지 않는다", () => {
  const source = "🎯 구매금액이 많은 또는 구매횟수가 적은 고객";
  const questions = [criterion(source, "구매금액이 많은", "amount", "구매 금액", "10000원"),
    criterion(source, "구매횟수가 적은", "count", "구매 횟수", "3회")];
  assert.deepEqual(buildCriterionBatch(questions,
    [...questions].reverse().map((q) => ({ issueId: q.issueId, optionId: "option" }))), {
      kind: "rewrite", deferredAnswerCount: 0,
      query: "🎯 구매금액이 많은 (구매 금액: 10000원) 또는 구매횟수가 적은 (구매 횟수: 3회) 고객",
    });
});

test("미선택·중복 답·알 수 없는 보기·다른 원문을 조합하지 않는다", () => {
  const source = "2026년 구매금액이 많은 고객";
  const questions = [criterion(source, "구매금액이 많은", "comparison", "비교 방향", "이상"),
    criterion(source, "구매금액이 많은", "value", "수치 기준", "10000원")];
  const answers = questions.map((q) => ({ issueId: q.issueId, optionId: "option" }));
  for (const invalid of [answers.slice(0, 1), [answers[0], answers[0]],
    [answers[0], { ...answers[1], optionId: "unknown" }]]) {
    assert.equal(buildCriterionBatch(questions, invalid).kind, "invalid");
  }
  questions[1].criterionInput!.sourceQuery = "다른 고객";
  assert.equal(buildCriterionBatch(questions, answers).kind, "invalid");
});

test("선택지가 원문을 삭제하거나 다른 위치를 가리키면 적용하지 않는다", () => {
  const source = "2026년 구매금액이 많은 고객";
  for (const change of ["query", "offset"] as const) {
    const q = criterion(source, "구매금액이 많은", "value", "수치 기준", "10000원");
    if (change === "query") q.options[0].query = q.options[0].query!.replace("2026년 ", "");
    else q.criterionInput!.insertionOffset = -1;
    assert.equal(buildCriterionBatch([q], [{ issueId: q.issueId, optionId: "option" }]).kind, "invalid");
  }
});

test("재서술형 1,000명 선택은 답 payload가 아니라 완성 문장 재실행이 된다", () => {
  const query = "최근 5일 구매 금액이 높은 1,000명 고객 타겟팅 해줘";
  const questions = [
    question({
      answerShape: "restatement",
      options: [{ id: query, label: "1,000명", query }],
    }),
  ];
  const answers: ClarificationAnswer[] = [
    { issueId: "ranking-issue", optionId: query, optionLabel: "1,000명" },
  ];

  assert.deepEqual(buildClarificationSubmission(questions, answers), {
    kind: "rewrite",
    query,
    deferredAnswerCount: 0,
  });
});

test("재서술형 자유 입력은 슬롯 값이 아니라 사용자가 다시 쓴 전체 요청으로 실행한다", () => {
  const query = "최근 5일 구매 금액이 높은 고객 중 상위 500명을 타겟팅해줘";
  const questions = [
    question({
      answerShape: "restatement",
      options: [],
      allowFreeText: true,
    }),
  ];

  assert.deepEqual(
    buildClarificationSubmission(questions, [
      { issueId: "ranking-issue", text: `  ${query}  ` },
    ]),
    {
      kind: "rewrite",
      query,
      deferredAnswerCount: 0,
    },
  );
});

test("일반 선택지는 기존 issue_id와 option_id 답을 유지한다", () => {
  const questions = [
    question({ options: [{ id: "row", label: "주문 1건" }] }),
  ];
  const answers: ClarificationAnswer[] = [
    { issueId: "ranking-issue", optionId: "row" },
  ];

  assert.deepEqual(buildClarificationSubmission(questions, answers), {
    kind: "answers",
    answers,
  });
});

test("자유 입력은 기존 issue_id와 text 답을 유지한다", () => {
  const questions = [question({ options: [], allowFreeText: true })];
  const answers: ClarificationAnswer[] = [
    { issueId: "ranking-issue", text: "기저귀" },
  ];

  assert.deepEqual(buildClarificationSubmission(questions, answers), {
    kind: "answers",
    answers,
  });
});

test("재서술형 선택지에 완성 문장이 없으면 일반 답으로 폴백하지 않는다", () => {
  const questions = [
    question({
      answerShape: "restatement",
      options: [{ id: "1000", label: "1,000명" }],
    }),
  ];

  const result = buildClarificationSubmission(questions, [
    { issueId: "ranking-issue", optionId: "1000" },
  ]);

  assert.equal(result.kind, "invalid");
  assert.match(result.kind === "invalid" ? result.message : "", /요청 문장/);
});
