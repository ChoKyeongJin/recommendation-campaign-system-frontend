import assert from "node:assert/strict";
import test from "node:test";

import type { ClarificationQuestion } from "./campaign-data.ts";
import {
  clarificationOptionQuery,
  clarificationPresentation,
  requestChoiceQuery,
} from "./clarification-choice.ts";

const LIFETIME =
  "2026년 3월에 진행한 캠페인에 참여했지만 구매 이력이 없는 고객 리스트를 추출해줘";
const SAME_WINDOW =
  "2026년 3월에 진행한 캠페인에 참여했지만 2026년 3월에 구매하지 않은 고객 리스트를 추출해줘";

function requestChoice(): ClarificationQuestion {
  return {
    questionId: "q-absence",
    issueId: "absence",
    code: "AMBIGUOUS_EVENT_ABSENCE_SCOPE",
    text: "'구매하지 않은'를 어떤 범위로 볼지에 따라 추출되는 고객이 달라집니다.",
    slot: "event_absence.scope",
    options: [
      { id: "lifetime", label: "전체 구매 이력이 없는 고객", query: LIFETIME },
      { id: "bounded_window", label: "2026년 3월에 구매하지 않은 고객", query: SAME_WINDOW },
    ],
    allowFreeText: false,
    answerShape: "restatement",
    presentation: "request_choice",
  };
}

test("백엔드가 명시한 query 를 그대로 쓰고 라벨로 문장을 만들지 않는다", () => {
  assert.equal(
    clarificationOptionQuery("restatement", { query: LIFETIME, value: "다른 값" }),
    LIFETIME,
  );
});

test("query 가 없던 재서술 응답은 value 가 완성 문장이고 슬롯 값은 문장이 아니다", () => {
  assert.equal(clarificationOptionQuery("restatement", { value: ` ${LIFETIME} ` }), LIFETIME);
  assert.equal(clarificationOptionQuery("slot_fill", { value: "row" }), "");
});

test("알 수 없는 presentation 은 기존 화면으로 읽는다", () => {
  assert.equal(clarificationPresentation("request_choice"), "request_choice");
  assert.equal(clarificationPresentation(undefined), "default");
  assert.equal(clarificationPresentation("free_text"), "default");
});

test("고르지 않으면 실행할 문장이 없고, 고르면 그 보기의 완성 문장만 보낸다", () => {
  const question = requestChoice();
  assert.equal(requestChoiceQuery(question, undefined), null);
  assert.equal(requestChoiceQuery(question, "unknown"), null);
  assert.equal(requestChoiceQuery(question, "bounded_window"), SAME_WINDOW);
});
