import assert from "node:assert/strict";
import test from "node:test";
import { applyMessage, applyingSettings, connectionError, coverageChange, editCount, emptyChanges, fieldChange, replaceChange, switchCoverageMode, errorMessage, databaseColumns, databaseColumnStatus, editableField, filterDatabaseColumns, type ApplyJob, type FieldConnection, type NewField, type SetupSnapshot } from "./profile-setup.ts";

test("DB 연결 표시는 미완료 초안과 관계 키를 조건 필드와 구분한다", () => {
  const column = { name: "id", data_type: "string", nullable: false, primary_key: true, field_ids: [] as string[] };
  const draft = { source: "event", column: "id", data_type: "string", _onboarding_gaps: { label: {} } };
  assert.equal(databaseColumnStatus(column, {}), "고객·사건 연결 필요");
  assert.equal(databaseColumnStatus({ ...column, structural_roles: ["subject.key"] }, {}), "관계·기준 키로 사용");
  assert.equal(databaseColumnStatus({ ...column, field_ids: ["event.id"] }, { "event.id": draft }), "필드 의미 설정 필요");
  assert.equal(databaseColumnStatus({ ...column, configured_field_ids: ["event.id"] }, {}), "조건 설정 1개 연결");
  assert.equal(databaseColumnStatus({ ...column, internal_field_ids: ["internal.id"] }, {}), "내부 계산에 사용 중");
});

test("DB 검색은 미연결 컬럼과 다른 테이블을 참조하는 이름 설정도 보여 준다", () => {
  const snapshot: SetupSnapshot = {
    profile: "test", revision: "", restart_required: false, subject: { table: "people", key: "id" },
    fields: { "event.title": { source: "event", column: "title", data_type: "string", label: "상품명", expression: "declared expression" } },
    database_schema: { tables: [
      { name: "products", database: "shop", columns: [
        { name: "product_name", data_type: "text", nullable: true, primary_key: false, field_ids: ["event.title"] },
        { name: "unmapped_name", data_type: "text", nullable: null, primary_key: false, field_ids: [] },
      ] },
      { name: "campaign_master", database: "shop", columns: [
        { name: "campaign_name", data_type: "text", nullable: false, primary_key: false, field_ids: [] },
      ] },
    ], unmapped_field_ids: [] },
    domains: {}, sources: {}, families: [], coverage: {}, files: [],
    basics: { base_entity: { age_column: "age" }, active_state: {} },
  };
  const rows = databaseColumns(snapshot);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((row) => row.key)).size, 3);
  assert.equal(filterDatabaseColumns(rows, snapshot.fields, " NAME ", "").length, 3);
  assert.equal(filterDatabaseColumns(rows, snapshot.fields, "상품명", "products")[0]?.name, "product_name");
  assert.equal(filterDatabaseColumns(rows, snapshot.fields, "campaign_name", "")[0]?.table, "campaign_master");
  assert.equal(filterDatabaseColumns(rows, snapshot.fields, "campaign_name", "products").length, 0);
  assert.equal(filterDatabaseColumns(rows, snapshot.fields, "shop", "").length, 3);
  const pending = { ...fieldChange("event.title", snapshot.fields["event.title"]), label: "새 상품 이름" };
  assert.equal(filterDatabaseColumns(rows, snapshot.fields, "새 상품", "", [pending])[0]?.name, "product_name");
  assert.deepEqual(databaseColumns({ ...snapshot, database_schema: undefined }), []);
});

test("계산·내부 필드는 검색되더라도 기존 편집 제한을 유지한다", () => {
  const field = { source: "event", column: "name", data_type: "string" };
  assert.equal(editableField(field), true);
  assert.equal(editableField({ ...field, expression: "" }), false);
  assert.equal(editableField({ ...field, expression: "declared expression" }), false);
  assert.equal(editableField({ ...field, semantic_visibility: "lowering_only" }), false);
  assert.equal(editableField({ ...field, expression: "declared expression", setup_editable: true }), true);
  assert.equal(editableField({ ...field, setup_editable: false }), false);
  assert.equal(editableField({ ...field, semantic_visibility: "lowering_only", setup_editable: true }), false);
});

test("새 연결은 근거·의미·단위를 채워야 저장 목록에 추가할 수 있다", () => {
  const option: FieldConnection = { id: "binding", field_id: "activity.count", source: "activity", source_label: "활동", source_table: "activity_rows", table: "masters", column: "count", data_type: "number", nullable: true, kind: "lookup", keys: [{ source_column: "master_id", target_column: "id" }], allowed_operators: ["=", ">=", "<"] };
  const field: NewField = { binding_id: "binding", label: "활동 수", semantic_description: "대상 전체의 저장된 활동 수", allowed_operators: [">="], unit: "count", value_domain: null, negative_null_policy: "exclude_unknown" };
  assert.equal(connectionError(field, option), "");
  assert.notEqual(connectionError(field, undefined), "");
  assert.notEqual(connectionError({ ...field, label: " " }, option), "");
  assert.notEqual(connectionError({ ...field, semantic_description: " " }, option), "");
  assert.notEqual(connectionError({ ...field, unit: null }, option), "");
  assert.notEqual(connectionError({ ...field, allowed_operators: [] }, option), "");
  assert.notEqual(connectionError({ ...field, allowed_operators: ["contains"] }, option), "");
  const changes = { ...emptyChanges(), new_fields: [field] };
  assert.equal(editCount(changes), 1);
  assert.equal(editCount({ ...changes, new_fields: [] }), 0);
  assert.equal("expression" in changes.new_fields[0], false);
});

test("새 문자열 연결은 값 목록을 선택하면 부분 검색을 허용하지 않는다", () => {
  const option: FieldConnection = { id: "binding", field_id: "activity.name", source: "activity", source_label: "활동", source_table: "activities", table: "products", column: "name", data_type: "string", nullable: true, kind: "lookup", keys: [], allowed_operators: ["=", "contains"] };
  const field: NewField = { binding_id: "binding", label: "상품명", semantic_description: "활동한 상품 이름", allowed_operators: ["contains"], unit: null, value_domain: null, negative_null_policy: "exclude_unknown" };
  assert.equal(connectionError(field, option), "");
  assert.notEqual(connectionError({ ...field, value_domain: "registered" }, option), "");
});

test("인덱스 생성이나 재시작 요청만으로 적용 성공을 표시하지 않는다", () => {
  for (const status of ["queued", "indexing", "restarting"] as const) {
    const job: ApplyJob = { id: "job", revision: "revision", status, code: "" };
    assert.equal(applyingSettings(job), true);
    assert.equal(applyMessage(job).includes("완료했습니다"), false);
  }
  assert.equal(applyingSettings({ id: "job", revision: "revision", status: "ready", code: "" }), false);
});

test("인덱스 실패와 재시작 실패를 구분하고 다시 적용할 수 있다", () => {
  const job: ApplyJob = { id: "job", revision: "revision", status: "failed", code: "index_failed" };
  assert.equal(applyingSettings(job), false);
  assert.match(applyMessage(job), /재시작하지 않았습니다/);
  assert.match(applyMessage({ ...job, code: "restart_failed" }), /정상 동작을 확인하지 못/);
});

test("수정하지 않은 항목은 저장 요청에 넣지 않는다", () => {
  assert.deepEqual(emptyChanges(), { fields: [], new_fields: [], domains: [], coverage: [] });
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
test("서버 오류의 구체적인 이유를 보여 준다", () => {
  assert.equal(errorMessage({ detail: { code: "revision_conflict", reason: "새로 불러오세요" } }), "새로 불러오세요");
});
