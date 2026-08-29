import assert from "node:assert/strict";
import test from "node:test";

import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "./campaign-data.ts";
import { buildClarificationSubmission } from "./clarification-submission.ts";

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
