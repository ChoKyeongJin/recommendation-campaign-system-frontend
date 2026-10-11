import assert from "node:assert/strict";
import test from "node:test";
import { blankGroup, conditionError, conditionPoliciesValid, conditionSummary, selectCondition, type ConditionGroup, type ConditionOptions } from "./company-policy-conditions.ts";
import { editCount, emptyChanges } from "./profile-setup.ts";

const menu: ConditionOptions = { subject_source: "member", fields: [
  { id: "member.age", label: "나이", source_id: "member", kind: "number", operators: ["=", ">=", "<"], unit: "year", choices: [], integer: true, minimum: "0", maximum: "120" },
  { id: "order.product", label: "상품", source_id: "order", kind: "string", operators: ["=", "contains"], unit: null, choices: [], integer: false, minimum: null, maximum: null },
], events: [{ id: "order", label: "주문" }], metrics: [{ id: "order.amount", label: "주문 합계", operators: [">=", "<"], unit: "KRW", integer: false }] };
const age = () => ({ kind: "field" as const, field_id: "member.age", operator: ">=", value: "30", unit: "year" });
const tree = (): ConditionGroup => ({ kind: "group", mode: "all", children: [age()] });

test("빈 조건은 저장할 수 없고 선택된 필드의 비교·단위를 사용한다", () => {
  assert.ok(conditionError(blankGroup(), menu));
  assert.equal(conditionError(tree(), menu), "");
  const selected = selectCondition("metric:order.amount", menu);
  assert.equal(selected.kind, "metric");
  if (selected.kind === "metric") assert.equal(selected.unit, "KRW");
});

test("AND/OR 중첩과 최근 기간이 미리보기·전송에 그대로 남는다", () => {
  const condition: ConditionGroup = { kind: "group", mode: "all", children: [age(), {
    kind: "group", mode: "any", children: [{ kind: "event", source_id: "order", mode: "absent", days: 90, where: null },
      { kind: "metric", metric_id: "order.amount", operator: ">=", value: "12.34567890123456789", unit: "KRW", days: 30 }],
  }] };
  assert.equal(conditionError(condition, menu), "");
  const preview = conditionSummary(condition, menu);
  assert.ok(preview.includes("그리고") && preview.includes("또는") && preview.includes("최근 90일"));
  assert.ok(JSON.stringify(condition).includes("12.34567890123456789"));
});

test("같은 이력의 필드만 묶을 수 있고 다른 사건이나 고객 필드는 거절한다", () => {
  const where: ConditionGroup = { kind: "group", mode: "all", children: [
    { kind: "field", field_id: "order.product", operator: "=", value: "A", unit: null }] };
  const condition: ConditionGroup = { kind: "group", mode: "all", children: [{ kind: "event", source_id: "order", mode: "exists", days: 30, where }] };
  assert.equal(conditionError(condition, menu), "");
  where.children = [age()];
  assert.ok(conditionError(condition, menu));
  assert.ok(conditionError({ ...tree(), children: [{ kind: "metric", metric_id: "order.amount", operator: ">=", value: "2", unit: "percent", days: 1 }] }, menu));
});

test("범위·정수·깊이·빈 묶음과 기간 오류를 저장 전에 알린다", () => {
  for (const value of ["121", "-1", "30.5", "NaN", "", "10%"])
    assert.ok(conditionError({ ...tree(), children: [{ ...age(), value }] }, menu));
  assert.ok(conditionError({ ...tree(), children: [] }, menu));
  for (const days of [0, -1, 0.5, 36501])
    assert.ok(conditionError({ ...tree(), children: [{ kind: "event", source_id: "order", mode: "exists", days, where: null }] }, menu));
  let nested = tree();
  for (let i = 0; i < 5; i++) nested = { ...tree(), children: [nested] };
  assert.ok(conditionError(nested, menu));
});

test("이름 충돌과 알 수 없는 정책 수정은 막고 조합 정책도 변경 수에 포함한다", () => {
  const created = { name: "패밀리 고객", condition: tree() };
  assert.equal(conditionPoliciesValid(menu, [], [created], []), true);
  assert.equal(conditionPoliciesValid(menu, [], [created], [], [{ name: "패밀리고객" }]), false);
  assert.equal(conditionPoliciesValid(menu, [], [], [{ id: "missing", condition: tree() }]), false);
  assert.equal(conditionPoliciesValid(undefined, [], [created], []), false);
  assert.equal(editCount({ ...emptyChanges(), new_condition_policies: [created], condition_policies: [{ id: "saved", condition: tree() }] }), 2);
});
