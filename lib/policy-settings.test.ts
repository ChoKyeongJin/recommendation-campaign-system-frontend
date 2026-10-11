import assert from "node:assert/strict";
import test from "node:test";
import { changePolicy, newPolicy, newPolicyNameError, policyChangesValid, policyCreationsValid, policyInputError, policyValue, policyValueLabel, type PolicyCard, type PolicySetting } from "./policy-settings.ts";
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

test("새 정책은 기준의 모든 값을 확인하게 하고 기존 기준을 수정하지 않는다", () => {
  const template = { ...card, creatable: true };
  const created = newPolicy(template, "패밀리 고객");
  created.settings[0].value = "10";
  assert.equal(template.settings[0].value, "20");
  assert.equal(policyCreationsValid([template], [created]), true);
  assert.equal(editCount({ ...emptyChanges(), new_policies: [created] }), 1);
  assert.equal(policyCreationsValid([template], [{ ...created, settings: [] }]), false);
});

test("빈 이름·중복 이름·지원하지 않는 기준으로 새 정책을 저장하지 않는다", () => {
  const template = { ...card, creatable: true };
  for (const name of ["", " ", "123", "우수 고객", "우수고객", "고객\n조건"]) {
    assert.ok(newPolicyNameError(name, [template], []));
    assert.equal(policyCreationsValid([template], [newPolicy(template, name)]), false);
  }
  const created = newPolicy(template, "패밀리 고객");
  assert.equal(policyCreationsValid([card], [created]), false);
  assert.equal(policyCreationsValid([template], [created, { ...created, name: "패밀리고객" }]), false);
  assert.equal(policyCreationsValid([template], [{ ...created, template_id: "unknown" }]), false);
});

test("새 정책의 기준 값도 저장 전에 검사하고 소수 정밀도를 보존한다", () => {
  const template = { ...card, creatable: true };
  const created = newPolicy(template, "패밀리 고객");
  created.settings[0].value = "12.34567890123456789";
  assert.equal(policyCreationsValid([template], [created]), true);
  assert.equal(created.settings[0].value, "12.34567890123456789");
  created.settings[0].value = "101";
  assert.equal(policyCreationsValid([template], [created]), false);
});
