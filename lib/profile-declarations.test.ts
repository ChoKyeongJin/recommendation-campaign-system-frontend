import assert from "node:assert/strict";
import test from "node:test";
import {
  creationError, eventError, measureFields, metricError, moveValue, newDomainId, populationFields, rankingPolicyChange, rankingPolicyError,
  repeatedEvents, type NewEvent, type NewMetric, type ProfileCreateRequest, type ProfileTable,
} from "./profile-declarations.ts";
import type { SetupSnapshot } from "./profile-setup.ts";

const snapshot = {
  profile: "hr_people", revision: "r", restart_required: false,
  subject: { name: "subject", table: "emp_master", key: "emp_id", label: "직원" },
  fields: {
    "subject.emp_status": { source: "subject", column: "emp_status", data_type: "string", label: "재직 상태", value_domain: "employment_status" },
    "overtime.overtime_hours": { source: "overtime", column: "overtime_hours", data_type: "number", label: "초과 근무 시간", unit: "hour" },
    "overtime.overtime_type": { source: "overtime", column: "overtime_type", data_type: "string", label: "유형" },
    "overtime.draft": { source: "overtime", column: "draft", data_type: "number", unit: "hour", _onboarding_gaps: { label: true } },
  },
  domains: { employment_status: { label: "재직 상태", editable: true, values: [
    { canonical: "status_active", physical: "ACTIVE", label: "재직", description: "" }] } },
  sources: { overtime: { label: "초과 근무", table: "emp_overtime" }, hire: { label: "입사", table: "emp_master" } },
  families: [], coverage: {}, basics: { base_entity: {}, active_state: {} }, files: [],
  events: {
    overtime: { label: "초과 근무", aliases: [], table: "emp_overtime", link_column: "emp_id", time_column: "work_date", clock: "date", kind: "fact_table", timezone: "Asia/Seoul", semantic_description: "" },
    hire: { label: "입사", aliases: [], table: "emp_master", link_column: "emp_id", time_column: "hire_date", clock: "date", kind: "subject_column", timezone: "Asia/Seoul", semantic_description: "" },
  },
  event_connections: [{ id: "opt-leave", table: "emp_leave", link_column: "emp_id", time_column: "start_date", clock: "date", row_identity: ["leave_id"], kind: "fact_table", foreign_key: false }],
  metrics: {}, ranking_policy: null,
} as unknown as SetupSnapshot;

const event = (patch: Partial<NewEvent> = {}): NewEvent => ({
  binding_id: "opt-leave", id: "leave", label: "휴가", aliases: ["연차"], semantic_description: "휴가 사용 기록.", timezone: "Asia/Seoul", ...patch });
const metric = (patch: Partial<NewMetric> = {}): NewMetric => ({
  id: "overtime_hours_total", source: "overtime", function: "sum", measure_field: "overtime.overtime_hours",
  label: "초과 근무 시간", aliases: [], semantic_description: "직원별 합.", ranking: false, ...patch });

test("an event needs an offered option, a free id, distinct names and a time zone", () => {
  assert.equal(eventError(event(), snapshot, []), "");
  assert.match(eventError(event({ binding_id: "gone" }), snapshot, []), /표와 컬럼/);
  assert.match(eventError(event({ id: "Leave" }), snapshot, []), /영문 소문자/);
  assert.match(eventError(event({ id: "overtime" }), snapshot, []), /이미 쓰이는/);
  assert.match(eventError(event({ aliases: ["휴가"] }), snapshot, []), /중복/);
  assert.match(eventError(event({ timezone: " " }), snapshot, []), /시간대/);
  const first = event(); const second = event({ id: "leave2" });
  assert.match(eventError(second, snapshot, [first, second]), /두 번/);
});

test("a metric counts over a saved repeated event and measures a finished numeric field", () => {
  assert.deepEqual(repeatedEvents(snapshot), [["overtime", "초과 근무"]]);
  assert.deepEqual(measureFields(snapshot, "overtime").map(([id]) => id), ["overtime.overtime_hours"]);
  assert.equal(metricError(metric(), snapshot, [], false), "");
  assert.match(metricError(metric({ source: "hire" }), snapshot, [], false), /여러 번/);
  assert.match(metricError(metric({ measure_field: "overtime.overtime_type" }), snapshot, [], false), /숫자 필드/);
  assert.match(metricError(metric({ function: "count" }), snapshot, [], false), /횟수/);
  assert.equal(metricError(metric({ function: "count", measure_field: null }), snapshot, [], false), "");
  assert.match(metricError(metric({ ranking: true }), snapshot, [], false), /순위 정책/);
  assert.equal(metricError(metric({ ranking: true }), snapshot, [], true), "");
});

test("a ranking population is a value of a subject field bound to a list", () => {
  assert.deepEqual(populationFields(snapshot), [["subject.emp_status", "재직 상태"]]);
  const change = { ...rankingPolicyChange(snapshot), label: "직원 지표 순위", population_field: "subject.emp_status", population_value: "status_active" };
  assert.deepEqual(change.limit_units, ["count", "percent"]);
  assert.equal(rankingPolicyError(change, snapshot), "");
  assert.match(rankingPolicyError({ ...change, population_value: "nope" }, snapshot), /값을 고르세요/);
  assert.match(rankingPolicyError({ ...change, limit_units: [] }, snapshot), /컷 단위/);
});

test("ordering moves one value and never past the ends", () => {
  assert.deepEqual(moveValue(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(moveValue(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
  assert.deepEqual(moveValue(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
});

test("a new profile names a subject keyed by its primary key and closes age or state explicitly", () => {
  const tables: ProfileTable[] = [{ name: "emp_master", object_type: "table", primary_key: ["emp_id"], columns: [
    { name: "emp_id", type: "varchar(10)", nullable: false }, { name: "age", type: "int(11)", nullable: false },
    { name: "emp_status", type: "varchar(10)", nullable: false }] }];
  const request: ProfileCreateRequest = { target: "newdb", driver: "pymysql", tables: ["emp_master"], subject_table: "emp_master",
    subject_key: "emp_id", subject_label: "직원", age_column: "age", active_column: "emp_status", active_value: "ACTIVE" };
  assert.equal(creationError(request, tables), "");
  assert.equal(creationError({ ...request, age_column: null, active_column: null, active_value: null }, tables), "");
  assert.match(creationError({ ...request, subject_key: "age" }, tables), /기본 키/);
  assert.match(creationError({ ...request, age_column: "emp_status" }, tables), /숫자/);
  assert.match(creationError({ ...request, active_value: null }, tables), /함께/);
  assert.match(creationError({ ...request, tables: [] }, tables), /하나 이상/);
});

test("a new value list id carries no dots, so its values settle", () => {
  assert.equal(newDomainId("subject.job_grade"), "setup_subject_job_grade");
  assert.match(newDomainId("Subject.Job-Grade"), /^[a-z][a-z0-9_]*$/);
});
