import assert from "node:assert/strict";
import test from "node:test";
import { changePolicy, policyChangesValid, policyInputError, policyValue, policyValueLabel, type PolicyCard, type PolicySetting } from "./policy-settings.ts";
import { editCount, emptyChanges } from "./profile-setup.ts";

const setting: PolicySetting = { id: "percent", label: "선정 비율", value: "20", kind: "decimal", unit: "%", minimum: "0.0001", maximum: "100", disabled: false, hint: "", options: [] };
const card: PolicyCard = { id: "policy", label: "우수 고객", group: "고객 분류 기준", summary: "상위 20%", settings: [setting], notes: [] };

test("비율을 숫자로 변환하지 않고 정확한 문자열로 저장 요청에 전달한다", () => {
  const changes = changePolicy([], card, setting, "12.34567890123456789");
  assert.equal(changes[0].settings[0].value, "12.34567890123456789");
  assert.equal(policyValue(card, setting, changes), "12.34567890123456789");
  assert.equal(policyValueLabel(setting, changes[0].settings[0].value), "12.34567890123456789 %");
});

test("원래 값으로 돌아오면 변경 표시가 사라지고 다른 설정은 보존한다", () => {
  const existing = [{ id: "other", settings: [{ id: "days", value: 90 }] }];
  const changed = changePolicy(existing, card, setting, "10");
  assert.equal(editCount({ ...emptyChanges(), policies: changed }), 2);
  assert.deepEqual(changePolicy(changed, card, setting, "20"), existing);
});

test("비어 있거나 잘못된 숫자는 저장 전에 바로 알려 준다", () => {
  for (const value of ["", "NaN", "Infinity", "100.1", "-5", "1e99", "0", "10 "]) {
    assert.ok(policyInputError(setting, value));
    assert.equal(policyChangesValid([card], [{ id: card.id, settings: [{ id: setting.id, value }] }]), false);
  }
  assert.equal(policyInputError(setting, "12.5"), "");
  assert.equal(policyInputError({ ...setting, kind: "integer" }, "1.5"), "올바른 숫자를 입력하세요.");
  assert.ok(policyInputError({ ...setting, kind: "integer" }, "1.0"));
  assert.ok(policyInputError(setting, 12.5));
  assert.equal(policyInputError({ ...setting, kind: "integer" }, 12), "");
});

test("고정된 설정과 화면에 없는 정책은 저장하지 않는다", () => {
  const fixed = { ...setting, disabled: true };
  assert.deepEqual(changePolicy([], card, fixed, "5"), []);
  assert.equal(policyChangesValid([card], [{ id: "unknown", settings: [{ id: setting.id, value: "5" }] }]), false);
  assert.equal(policyChangesValid([card], [{ id: card.id, settings: [{ id: "path", value: "5" }] }]), false);
});

test("사용 안 함과 0을 빈 값으로 바꾸지 않는다", () => {
  const toggle = { ...setting, id: "widen", kind: "toggle" as const, value: true };
  const questions = { ...setting, id: "questions", kind: "integer" as const, value: 3, minimum: "0" };
  let changes = changePolicy([], card, toggle, false);
  changes = changePolicy(changes, card, questions, 0);
  assert.equal(policyValue(card, toggle, changes), false);
  assert.equal(policyValue(card, questions, changes), 0);
});
