import assert from "node:assert/strict";
import test from "node:test";

import { mapSupportLimit } from "./support-limit.ts";

/**
 * 백엔드(`failure_explanation._support_limit_block`)가 실제로 싣는 모양.
 *
 * `상품 조회 후 24시간 안에 같은 상품을 구매한 고객` 처럼 **문장이 틀린 것이 아니라 실행할
 * 준비가 안 된** 요청의 응답이다. 두 구절이 서로 다른 이유로 막혔고, 둘 다 사용자가 고칠 수
 * 있는 것이 아니다.
 */
const CARD = {
  show_unavoidable_explanation: true,
  title: "조건은 이해했지만 현재는 실행할 수 없어요",
  understood: "상품 조회 후 24시간 안에 같은 상품을 구매한 고객",
  reason: "정보는 준비되어 있지만, 요청하신 계산 방식은 아직 지원하지 않아요.",
  blocked_conditions: [
    {
      text: "24시간 안에",
      reason: "정보는 준비되어 있지만, 요청하신 계산 방식은 아직 지원하지 않아요.",
    },
    {
      text: "같은 상품",
      reason:
        "필요한 정보는 있지만, 현재 시스템에서 이 조건에 사용할 수 있도록 연결되지 않았어요.",
    },
  ],
  user_can_fix: false,
  next_action:
    "요청 문장을 바꿀 필요는 없습니다. 기능이 준비된 후 같은 문장으로 다시 실행할 수 있어요.",
};

test("두 구절이 서로 다른 이유와 함께 그대로 넘어온다", () => {
  const mapped = mapSupportLimit(CARD);

  assert.ok(mapped);
  assert.equal(mapped.title, CARD.title);
  assert.equal(mapped.understood, CARD.understood);
  assert.equal(mapped.nextAction, CARD.next_action);
  assert.equal(mapped.userCanFix, false);
  assert.deepEqual(
    mapped.blockedConditions.map((row) => row.text),
    ["24시간 안에", "같은 상품"],
  );
  assert.notEqual(
    mapped.blockedConditions[0].reason,
    mapped.blockedConditions[1].reason,
    "연산 미지원과 선언 부재가 같은 문장으로 나가면 고칠 곳을 구분해 주지 못한다.",
  );
});

test("화면은 문장을 다시 쓰지 않는다 — 백엔드 문구가 그대로 나간다", () => {
  const mapped = mapSupportLimit(CARD);

  assert.ok(mapped);
  const rendered = [
    mapped.title,
    mapped.reason,
    mapped.nextAction,
    ...mapped.blockedConditions.map((row) => `${row.text} ${row.reason}`),
  ].join("\n");

  // 사용자 카드에 내부 분류 이름이 섞이면 그 순간 이 문구는 사람이 읽는 문장이 아니다.
  for (const code of [
    "data_not_available",
    "schema_contract_missing",
    "operation_not_supported",
    "execution_configuration_missing",
  ]) {
    assert.ok(!rendered.includes(code), `내부 코드가 카드에 노출됐다: ${code}`);
  }
  // 고칠 수 없는 실패에 문장 수정을 권하지 않는다.
  for (const advice of ["표현을 바꿔", "다시 써", "구체적으로 적어"]) {
    assert.ok(!mapped.nextAction.includes(advice));
  }
});

test("플래그가 없으면 카드를 만들지 않는다", () => {
  assert.equal(mapSupportLimit(null), null);
  assert.equal(mapSupportLimit(undefined), null);
  assert.equal(
    mapSupportLimit({ ...CARD, show_unavoidable_explanation: false }),
    null,
    "되묻기·DB 장애·내부 오류에는 백엔드가 이 블록을 만들지 않는다.",
  );
});

test("필수 문장이 비면 반쯤 빈 카드를 만들지 않는다", () => {
  assert.equal(mapSupportLimit({ ...CARD, title: "" }), null);
  assert.equal(mapSupportLimit({ ...CARD, next_action: "  " }), null);
});

test("구절을 짚지 못한 실패도 요청 수준의 한 문장은 남는다", () => {
  const mapped = mapSupportLimit({ ...CARD, blocked_conditions: [] });

  assert.ok(mapped);
  assert.deepEqual(mapped.blockedConditions, []);
  assert.equal(mapped.reason, CARD.reason);
});

test("이유 없는 구절은 '안 됩니다'의 다른 표기라 싣지 않는다", () => {
  const mapped = mapSupportLimit({
    ...CARD,
    blocked_conditions: [{ text: "같은 상품" }, ...CARD.blocked_conditions],
  });

  assert.ok(mapped);
  assert.equal(mapped.blockedConditions.length, 2);
});

test("user_can_fix 가 빠진 응답을 '고칠 수 있다'로 읽지 않는다", () => {
  const { user_can_fix: _omitted, ...withoutFlag } = CARD;
  const mapped = mapSupportLimit(withoutFlag);

  assert.ok(mapped);
  assert.equal(mapped.userCanFix, false);
});
