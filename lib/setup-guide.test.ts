import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProfileName,
  isUsableProfileName,
  PROFILE_PLACEHOLDER,
  SETUP_STEPS,
  SETUP_TROUBLESHOOTING,
} from "./setup-guide.ts";

test("한 명령에 두 번 나오는 프로필 자리를 모두 바꾼다", () => {
  // schema_extract 는 --profile 과 --connection 에 같은 이름을 받는다. 한 자리만 바뀌면
  // 복사한 명령이 다른 프로필의 커넥션을 읽는다.
  const command = `python schema_extract.py --profile ${PROFILE_PLACEHOLDER} --refresh-external --connection ${PROFILE_PLACEHOLDER}`;
  assert.equal(
    applyProfileName(command, "shop_ontology"),
    "python schema_extract.py --profile shop_ontology --refresh-external --connection shop_ontology",
  );
});

test("앞뒤 공백은 떼고 바꾼다", () => {
  assert.equal(
    applyProfileName(`--profile ${PROFILE_PLACEHOLDER}`, "  shop_ontology \n"),
    "--profile shop_ontology",
  );
});

test("셸에 그대로 넣기 어려운 이름은 바꾸지 않고 자리를 남긴다", () => {
  // 반쯤 채워진 명령을 복사해 가는 것보다 자리가 남아 보이는 편이 안전하다.
  for (const unusable of ["", "   ", "shop ontology", "shop;rm -rf /", "shop/ontology", "'shop'"]) {
    assert.equal(
      applyProfileName(`--profile ${PROFILE_PLACEHOLDER}`, unusable),
      `--profile ${PROFILE_PLACEHOLDER}`,
      `치환되면 안 되는 이름: ${JSON.stringify(unusable)}`,
    );
    assert.equal(isUsableProfileName(unusable), false);
  }
});

test("영문·숫자·밑줄·붙임표 이름은 받는다", () => {
  for (const usable of ["mss_ontology", "shop-2026", "A1"]) {
    assert.equal(isUsableProfileName(usable), true);
    assert.equal(applyProfileName(PROFILE_PLACEHOLDER, usable), usable);
  }
});

test("자리 표시가 없는 명령은 건드리지 않는다", () => {
  const command = "python db_swap_preflight.py --check-db";
  assert.equal(applyProfileName(command, "mss_ontology"), command);
});

test("이름을 넣으면 화면의 어느 명령에도 자리 표시가 남지 않는다", () => {
  // 안내 문안에 `<프로필>` 처럼 다른 자리 표시를 적으면 그 명령만 조용히 안 바뀐다.
  for (const step of SETUP_STEPS) {
    for (const command of step.commands) {
      assert.equal(
        applyProfileName(command, "mss_ontology").includes(PROFILE_PLACEHOLDER),
        false,
        `치환되지 않는 자리 표시가 남았다: ${command}`,
      );
    }
  }
});

test("모든 단계가 제목·요약과 읽을 내용을 함께 가진다", () => {
  // 내용 없는 단계는 화면에서 번호만 있는 빈 줄이 된다.
  assert.ok(SETUP_STEPS.length > 0);
  const ids = new Set<string>();
  for (const step of SETUP_STEPS) {
    assert.ok(step.title.trim(), `제목이 빈 단계: ${step.id}`);
    assert.ok(step.lead.trim(), `요약이 빈 단계: ${step.id}`);
    assert.ok(
      step.commands.length + step.notes.length + step.fillIns.length > 0,
      `읽을 내용이 없는 단계: ${step.id}`,
    );
    assert.equal(ids.has(step.id), false, `중복된 단계 id: ${step.id}`);
    ids.add(step.id);
  }
});

test("기계가 하는 단계에는 실행할 명령이 있다", () => {
  // "명령만 실행하면 된다"고 적어 놓고 명령을 안 보여 주면 그 단계는 할 일을 못 말한다.
  for (const step of SETUP_STEPS.filter((candidate) => candidate.kind === "machine")) {
    assert.ok(step.commands.length > 0, `명령이 없는 기계 단계: ${step.id}`);
  }
});

test("사람이 채우는 자리는 어디에·무엇을·왜를 모두 말한다", () => {
  const fillIns = SETUP_STEPS.flatMap((step) => step.fillIns);
  assert.ok(fillIns.length > 0);
  for (const fillIn of fillIns) {
    assert.ok(fillIn.where.trim(), "자리 이름이 비었다");
    assert.ok(fillIn.what.trim(), `무엇을 적는지가 비었다: ${fillIn.where}`);
    assert.ok(fillIn.detail.trim(), `안 적으면 어떻게 되는지가 비었다: ${fillIn.where}`);
  }
});

test("막혔을 때 읽을 줄이 비어 있지 않다", () => {
  assert.ok(SETUP_TROUBLESHOOTING.length > 0);
  for (const line of SETUP_TROUBLESHOOTING) {
    assert.ok(line.trim());
  }
});
