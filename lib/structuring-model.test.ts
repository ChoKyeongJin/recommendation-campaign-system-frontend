import assert from "node:assert/strict";
import test from "node:test";

import {
  chosenStructuringModel,
  DEFAULT_MODEL_OPTION,
  describeChoice,
  NO_STRUCTURING_MODEL_CHOICES,
  readStructuringModelChoices,
  shouldOfferChoice,
} from "./structuring-model.ts";

test("배포가 알려 준 순서를 그대로 읽는다", () => {
  // 드롭다운 순서가 곧 배포 선언이다. 정렬해 버리면 배포가 정한 순서가 사라진다.
  const read = readStructuringModelChoices({
    choices: ["gpt-5.4", "gpt-5.2", "gpt-5.1", "gpt-5-mini"],
    default: "gpt-5.2",
  });
  assert.deepEqual(read.choices, ["gpt-5.4", "gpt-5.2", "gpt-5.1", "gpt-5-mini"]);
  assert.equal(read.fallback, "gpt-5.2");
});

test("같은 이름이 두 번 와도 한 줄만 띄운다", () => {
  const read = readStructuringModelChoices({
    choices: ["gpt-5.2", " gpt-5.2 ", "gpt-5.1"],
  });
  assert.deepEqual(read.choices, ["gpt-5.2", "gpt-5.1"]);
});

test("모르는 모양은 빈 목록이지 오류가 아니다", () => {
  // 목록을 못 읽었다고 타겟 추출이 막히면 안 된다 — 그때는 배포 기본값으로 그냥 나간다.
  for (const payload of [null, undefined, "gpt-5.2", 7, {}, { choices: "gpt-5.2" }, { choices: [1, true] }]) {
    const read = readStructuringModelChoices(payload);
    assert.deepEqual(read.choices, [], `빈 목록이 아니다: ${JSON.stringify(payload)}`);
    assert.equal(read.fallback, null);
    assert.equal(shouldOfferChoice(read), false);
  }
});

test("고를 것이 있으면 칸을 띄우고, 없으면 감춘다", () => {
  assert.equal(shouldOfferChoice(NO_STRUCTURING_MODEL_CHOICES), false);
  // 하나뿐이어도 띄운다 — 그 하나가 배포 기본값과 다를 수 있다.
  assert.equal(shouldOfferChoice({ choices: ["gpt-5.4"], fallback: "gpt-5.2" }), true);
});

test("안 고르면 요청에 아무것도 싣지 않는다", () => {
  const available = { choices: ["gpt-5.4", "gpt-5.2"], fallback: "gpt-5.2" };
  assert.equal(chosenStructuringModel(DEFAULT_MODEL_OPTION, available), null);
  assert.equal(chosenStructuringModel("   ", available), null);
});

test("고른 것이 목록 밖이면 싣지 않는다", () => {
  // 방어가 아니라 낡음이다. 배포가 선언을 줄인 뒤에도 브라우저에 남아 있던 선택이 그대로
  // 나가면 요청이 400 으로 죽는다 — 사용자는 고른 적 없는 이름 때문에 막힌다.
  const available = { choices: ["gpt-5.4", "gpt-5.2"], fallback: "gpt-5.2" };
  assert.equal(chosenStructuringModel("gpt-5.1", available), null);
  assert.equal(chosenStructuringModel("gpt-5.4", available), "gpt-5.4");
});

test("지금 무엇으로 나가는지 한 줄로 말한다", () => {
  const available = { choices: ["gpt-5.4", "gpt-5.2"], fallback: "gpt-5.2" };
  assert.match(describeChoice("gpt-5.4", available), /gpt-5\.4/);
  // 안 골랐을 때 기본값 이름이 보여야, 고른 것과 같은지 눈으로 안다.
  assert.match(describeChoice(DEFAULT_MODEL_OPTION, available), /gpt-5\.2/);
  // 기본값을 모르면 이름 없이 말한다 — 지어내지 않는다.
  assert.doesNotMatch(
    describeChoice(DEFAULT_MODEL_OPTION, { choices: ["gpt-5.4"], fallback: null }),
    /gpt-/,
  );
});

test("낡은 선택은 설명에서도 고른 것으로 말하지 않는다", () => {
  // 설명과 실제로 나가는 값이 갈리면, 화면은 5.1 이라 적고 요청은 기본값으로 나간다.
  const available = { choices: ["gpt-5.4"], fallback: "gpt-5.2" };
  assert.equal(chosenStructuringModel("gpt-5.1", available), null);
  assert.match(describeChoice("gpt-5.1", available), /gpt-5\.2/);
});
