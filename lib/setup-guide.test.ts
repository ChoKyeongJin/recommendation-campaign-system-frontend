import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProfileName,
  applySetupValues,
  isUsableProfileName,
  isUsableValue,
  PROFILE_PLACEHOLDER,
  SETUP_INPUTS,
  SETUP_STEPS,
  SETUP_TROUBLESHOOTING,
  SUBJECT_KEY_PLACEHOLDER,
  SUBJECT_TABLE_PLACEHOLDER,
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

test("이름을 넣으면 화면의 어느 명령에도 프로필 자리 표시가 남지 않는다", () => {
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

test("세 칸을 다 채우면 명령에 자리 표시가 하나도 안 남는다", () => {
  // 입력칸이 자리 표시를 전부 덮는지를 여기서 잰다. 하나라도 덮지 못하면 사용자가 복사한
  // 명령에 `<...>` 가 남고, 그 자리는 화면 어디에도 채울 칸이 없다.
  const filled = {
    profile: "shop_ontology",
    subjectTable: "cust_profile",
    subjectKey: "customer_id",
  };
  for (const step of SETUP_STEPS) {
    for (const command of step.commands) {
      const applied = applySetupValues(command, filled);
      assert.equal(
        /<[^<>]+>/.test(applied),
        false,
        `자리 표시가 남았다: ${applied}`,
      );
    }
  }
});

test("한 칸이 비어도 나머지 칸은 채운다", () => {
  // 셋을 한꺼번에 알아야 하는 것이 아니다. 프로필만 정한 사람이 그 자리라도 채워 보게 둔다.
  const command = `python tools/profile_scaffold.py --profile ${PROFILE_PLACEHOLDER} --subject-table ${SUBJECT_TABLE_PLACEHOLDER} --subject-key ${SUBJECT_KEY_PLACEHOLDER}`;
  const applied = applySetupValues(command, { profile: "shop_ontology" });
  assert.ok(applied.includes("--profile shop_ontology"));
  assert.ok(applied.includes(SUBJECT_TABLE_PLACEHOLDER), "빈 칸의 자리 표시가 사라졌다");
  assert.ok(applied.includes(SUBJECT_KEY_PLACEHOLDER), "빈 칸의 자리 표시가 사라졌다");
});

test("표·컬럼 이름은 붙임표를 받지 않는다", () => {
  // 프로필은 `shop-2026` 을 받지만 뒤쪽 도구는 표·컬럼을 plain identifier 로 거절한다.
  // 화면이 받아 두면 사용자는 도구에서 막히고 나서야 안다.
  assert.equal(isUsableValue("profile", "shop-2026"), true);
  assert.equal(isUsableValue("subjectTable", "cust-profile"), false);
  assert.equal(isUsableValue("subjectKey", "customer-id"), false);
  assert.equal(isUsableValue("subjectTable", "cust_profile"), true);
  assert.equal(isUsableValue("subjectKey", "customer_id"), true);
});

test("셸에 그대로 넣기 어려운 표·컬럼 이름은 자리를 남긴다", () => {
  const command = `--subject-table ${SUBJECT_TABLE_PLACEHOLDER}`;
  for (const unusable of ["", "  ", "dbo.cust", "cust profile", "cust;drop", "'cust'", "cust*"]) {
    assert.equal(isUsableValue("subjectTable", unusable), false, `받으면 안 된다: ${unusable}`);
    assert.equal(
      applySetupValues(command, { subjectTable: unusable }),
      command,
      `치환되면 안 되는 값: ${JSON.stringify(unusable)}`,
    );
  }
});

test("입력칸 선언은 자리 표시마다 하나씩이고 칸마다 이름·예시·모양이 있다", () => {
  assert.ok(SETUP_INPUTS.length > 0);
  const seen = new Set<string>();
  for (const input of SETUP_INPUTS) {
    assert.equal(seen.has(input.placeholder), false, `중복된 자리 표시: ${input.placeholder}`);
    seen.add(input.placeholder);
    assert.ok(input.label.trim(), `이름이 빈 칸: ${input.id}`);
    // 예시는 입력칸에 흐리게 보이는 값이다 — 비면 무엇을 적는 칸인지 모양을 못 본다.
    assert.ok(input.example.trim(), `예시가 빈 칸: ${input.id}`);
    assert.ok(input.shape.trim(), `받는 글자 설명이 빈 칸: ${input.id}`);
    // 예시 자신이 그 칸의 규칙을 통과해야 한다. 아니면 화면이 못 받는 값을 보여 준다.
    assert.equal(isUsableValue(input.id, input.example), true, `못 받는 예시: ${input.example}`);
  }
});

test("명령의 모든 자리 표시에 입력칸이 하나씩 있다", () => {
  // 역방향 게이트. 자리 표시를 늘리면서 입력칸을 안 만들면, 사용자가 채울 길이 없는
  // `<...>` 가 복사한 명령에 남는다.
  const boxed = new Set(SETUP_INPUTS.map((input) => input.placeholder));
  for (const step of SETUP_STEPS) {
    for (const command of step.commands) {
      for (const token of command.match(/<[^<>]+>/g) ?? []) {
        assert.ok(boxed.has(token), `입력칸이 없는 자리 표시: ${token} (${command})`);
      }
    }
  }
});

test("설명 칸이 붙은 자리는 입력칸도 있다", () => {
  // 설명만 있고 칸이 없으면 "정해 두세요" 뒤에 적을 곳이 없다.
  const boxed = new Set(SETUP_INPUTS.map((input) => input.placeholder));
  for (const decision of SETUP_STEPS.flatMap((step) => step.decisions)) {
    assert.ok(boxed.has(decision.placeholder), `입력칸이 없는 설명: ${decision.placeholder}`);
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
      step.commands.length +
        step.notes.length +
        step.fillIns.length +
        step.decisions.length >
        0,
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

test("사람이 채우는 자리는 어느 파일의 어디에·무엇을·왜를 모두 말한다", () => {
  const fillIns = SETUP_STEPS.flatMap((step) => step.fillIns);
  assert.ok(fillIns.length > 0);
  for (const fillIn of fillIns) {
    // 파일 이름은 눌러서 여는 자리다. 비면 팝업이 아무것도 못 연다.
    assert.ok(fillIn.file.trim(), "열 파일 이름이 비었다");
    assert.ok(fillIn.file.endsWith(".json"), `json 이 아니다: ${fillIn.file}`);
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

test("명령에 남는 자리 표시는 프로필 아니면 설명 칸이 있는 것뿐이다", () => {
  // 역방향 게이트다. 설명을 단 자리만 세면, 다음에 자리 표시를 하나 더 넣는 사람이
  // 설명 없이 지나간다 — 화면은 `<무엇>` 이라고만 적혀 있고 읽는 사람이 스스로 고른다.
  // 실제로 <고객표>·<고객키> 가 그렇게 아홉 달을 있었다.
  const explained = new Set(
    SETUP_STEPS.flatMap((step) => step.decisions.map((decision) => decision.placeholder)),
  );
  for (const step of SETUP_STEPS) {
    for (const command of step.commands) {
      for (const token of command.match(/<[^<>]+>/g) ?? []) {
        if (token === PROFILE_PLACEHOLDER) continue; // 프로필은 화면 위 입력칸이 채운다
        assert.ok(
          explained.has(token),
          `설명 없는 자리 표시: ${token} (${command})`,
        );
      }
    }
  }
});

test("설명 칸의 자리 표시는 실제 명령에 그 글자 그대로 있다", () => {
  // 설명은 `<고객표>` 라 적고 명령은 다른 글자면, 나란히 놓여도 눈으로 이어지지 않는다.
  const commands = SETUP_STEPS.flatMap((step) => step.commands);
  for (const step of SETUP_STEPS) {
    for (const decision of step.decisions) {
      assert.ok(
        commands.some((command) => command.includes(decision.placeholder)),
        `어느 명령에도 없는 자리 표시: ${decision.placeholder}`,
      );
    }
  }
});

test("고객 표와 고객 키는 둘 다 설명이 붙어 있다", () => {
  // 이 둘은 사람이 DB 를 보면서 정하는 값이다. 하나만 설명하면 나머지 하나에서 막힌다.
  const byPlaceholder = new Map(
    SETUP_STEPS.flatMap((step) => step.decisions).map((decision) => [
      decision.placeholder,
      decision,
    ]),
  );
  for (const placeholder of [SUBJECT_TABLE_PLACEHOLDER, SUBJECT_KEY_PLACEHOLDER]) {
    assert.ok(byPlaceholder.has(placeholder), `설명이 없다: ${placeholder}`);
  }
});

test("설명 칸은 무엇인지·고르는 기준·지금 값을 모두 말한다", () => {
  const decisions = SETUP_STEPS.flatMap((step) => step.decisions);
  assert.ok(decisions.length > 0);
  const seen = new Set<string>();
  for (const decision of decisions) {
    assert.ok(decision.placeholder.trim(), "자리 표시가 비었다");
    assert.equal(seen.has(decision.placeholder), false, `중복된 자리 표시: ${decision.placeholder}`);
    seen.add(decision.placeholder);
    assert.ok(decision.title.trim(), `이름이 빈 설명: ${decision.placeholder}`);
    assert.ok(decision.plain.trim(), `쉬운 말이 빈 설명: ${decision.placeholder}`);
    // 기준이 없으면 "고객 표는 고객 표입니다" 가 된다 — 고르는 데 쓸 수 없는 설명이다.
    assert.ok(decision.pick.length > 0, `고르는 기준이 없다: ${decision.placeholder}`);
    for (const line of decision.pick) {
      assert.ok(line.trim());
    }
    assert.ok(decision.example.trim(), `지금 값이 빈 설명: ${decision.placeholder}`);
  }
});

test("설명 칸은 명령보다 먼저 읽는 단계에 있다", () => {
  // 명령을 복사한 뒤에 "무엇을 넣는가" 를 읽으면 이미 늦다.
  const decisionAt = SETUP_STEPS.findIndex((step) => step.decisions.length > 0);
  const usedAt = SETUP_STEPS.findIndex((step) =>
    step.commands.some((command) =>
      SETUP_STEPS.flatMap((owner) => owner.decisions).some((decision) =>
        command.includes(decision.placeholder),
      ),
    ),
  );
  assert.ok(decisionAt >= 0, "설명 칸을 가진 단계가 없다");
  assert.ok(usedAt >= 0, "자리 표시를 쓰는 명령이 없다");
  assert.ok(
    decisionAt <= usedAt,
    `설명(${decisionAt + 1}단계)이 그 자리를 쓰는 명령(${usedAt + 1}단계)보다 뒤에 있다`,
  );
});
