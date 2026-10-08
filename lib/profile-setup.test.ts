import assert from "node:assert/strict";
import test from "node:test";
import { coverageChange, emptyChanges, fieldChange, replaceChange, splitTerms, switchCoverageMode, errorMessage } from "./profile-setup.ts";

test("수정하지 않은 항목은 저장 요청에 넣지 않는다", () => {
  assert.deepEqual(emptyChanges(), { fields: [], domains: [], coverage: [] });
});
test("필드의 기존 값 목록과 단위를 보존한다", () => {
  const change = fieldChange("field", { source: "subject", column: "code", data_type: "string", value_domain: "codes", unit: "KRW" });
  assert.equal(change.value_domain, "codes"); assert.equal(change.unit, "KRW"); assert.equal(change.enable_draft, false);
});
test("필드 별칭을 저장 요청으로 보내지 않는다", () => {
  const field = { source: "subject", column: "age", data_type: "number", label: "나이", aliases: ["연령"] };
  assert.equal("aliases" in fieldChange("subject.age", field), false);
});
test("지원 안 함을 고르면 이전 필드 연결을 함께 보내지 않는다", () => {
  const changed = switchCoverageMode(coverageChange("gender", { fields: ["subject.gender"] }), "unsupported");
  assert.deepEqual(changed.fields, []); assert.deepEqual(changed.sources, []);
  assert.equal(switchCoverageMode({ ...changed, reason: "없음" }, "supported").reason, "");
});
test("같은 항목을 두 번 고쳐도 변경 한 건이며 다른 항목은 보존한다", () => {
  assert.deepEqual(replaceChange([{ id: "a", value: 1 }, { id: "b", value: 2 }], { id: "a", value: 3 }, (row) => row.id === "a"), [{ id: "b", value: 2 }, { id: "a", value: 3 }]);
});
test("별칭을 원자로 나누고 서버 오류의 구체적인 이유를 보여 준다", () => {
  assert.deepEqual(splitTerms("여성, 여자\n성별"), ["여성", "여자", "성별"]);
  assert.equal(errorMessage({ detail: { code: "revision_conflict", reason: "새로 불러오세요" } }), "새로 불러오세요");
});
