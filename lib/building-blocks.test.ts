import assert from "node:assert/strict";
import test from "node:test";

import {
  ABSENCE_BRANCH,
  ABSENCE_SEQUENCE,
  ACTORS,
  ASSEMBLY_STEPS,
  assembledBranches,
  BLOCK_GROUPS,
  BOUNDARY_FLOW,
  BOUNDARY_FLOW_NOTE,
  branchStep,
  edgesUpTo,
  EXAMPLE_REQUEST,
  EXAMPLE_SQL,
  EXAMPLE_SQL_NOTE,
  IF_WE_DID_IT_THE_OTHER_WAY,
  LAST_STEP,
  MAPPING_NOTE,
  MEANING_TO_BLOCKS,
  MODEL_CANNOT,
  MODEL_EXCHANGE,
  MODEL_STEP,
  nodesUpTo,
  OFF_MENU,
  OTHER_EXAMPLES,
  PROGRAM_CHECKS,
  SENTENCE_PARTS,
  TECHNICAL_NOTE,
  TREE_NODES,
  WHY_IT_MATTERS,
} from "./building-blocks.ts";

test("쪼갠 문장을 이어 붙이면 원래 요청과 같다", () => {
  // 한 글자라도 다르면 화면에 뜬 문장이 실제로 조립하는 문장과 달라진다.
  assert.equal(SENTENCE_PARTS.map((part) => part.text).join(""), EXAMPLE_REQUEST);
});

test("문장의 두 조각이 트리의 두 가지와 짝이 맞는다", () => {
  // 문장에는 색칠했는데 트리에 그 가지가 없으면, 색이 아무것도 가리키지 않는다.
  const inSentence = new Set(
    SENTENCE_PARTS.flatMap((part) => (part.branch ? [part.branch] : [])),
  );
  const inTree = new Set(TREE_NODES.map((node) => node.branch));
  for (const branch of inSentence) {
    assert.ok(inTree.has(branch), `문장에만 있는 가지: ${branch}`);
  }
  assert.ok(inTree.has("root"), "뿌리 가지가 없다");
});

test("첫 단계에는 아직 블록이 없다", () => {
  // 1단계는 문장을 조각으로 나누는 자리다. 트리가 먼저 나오면 순서가 뒤집힌다.
  assert.equal(nodesUpTo(1).length, 0);
  assert.equal(edgesUpTo(1).length, 0);
  assert.equal(assembledBranches(1).size, 0);
});

test("단계가 갈수록 블록이 줄지 않는다", () => {
  let previous = 0;
  for (let step = 1; step <= LAST_STEP; step += 1) {
    const count = nodesUpTo(step).length;
    assert.ok(count >= previous, `${step}단계에서 블록이 줄었다`);
    previous = count;
  }
  assert.equal(nodesUpTo(LAST_STEP).length, TREE_NODES.length);
});

test("조각은 자기 단계에서 조립된다", () => {
  // 3단계 설명은 「여성」을, 4단계 설명은 「구매하지 않은」을 만든다고 말한다.
  // 실제 조립 순서가 그와 어긋나면 설명과 그림이 따로 논다.
  assert.deepEqual([...assembledBranches(3)].sort(), ["left"]);
  assert.deepEqual([...assembledBranches(4)].sort(), ["left", "right"]);
  assert.deepEqual([...assembledBranches(5)].sort(), ["left", "right", "root"]);
});

test("선은 양쪽 블록이 둘 다 보일 때만 그린다", () => {
  for (let step = 1; step <= LAST_STEP; step += 1) {
    const visible = new Set(nodesUpTo(step).map((node) => node.id));
    for (const edge of edgesUpTo(step)) {
      assert.ok(visible.has(edge.from.id), `${step}단계: 안 보이는 부모 ${edge.from.id}`);
      assert.ok(visible.has(edge.to.id), `${step}단계: 안 보이는 자식 ${edge.to.id}`);
    }
  }
});

test("모든 블록은 뿌리까지 이어진다", () => {
  // 부모 id 를 잘못 적으면 그 가지가 통째로 떠서 선 없이 떠다닌다.
  const byId = new Map(TREE_NODES.map((node) => [node.id, node]));
  const roots = TREE_NODES.filter((node) => node.parent === null);
  assert.equal(roots.length, 1, "뿌리는 하나여야 한다");

  for (const node of TREE_NODES) {
    let current = node;
    let hops = 0;
    while (current.parent !== null) {
      const parent = byId.get(current.parent);
      assert.ok(parent, `없는 부모를 가리킨다: ${current.id} → ${current.parent}`);
      current = parent;
      hops += 1;
      assert.ok(hops <= TREE_NODES.length, `순환이다: ${node.id}`);
    }
    assert.equal(current.id, roots[0].id, `뿌리에 못 닿는다: ${node.id}`);
  }
});

test("부모가 자식보다 먼저 나오지 않는다", () => {
  // 먼저 나오면 그 사이 단계에서 선이 끊긴 채 매달린다.
  const byId = new Map(TREE_NODES.map((node) => [node.id, node]));
  for (const node of TREE_NODES) {
    if (node.parent === null) continue;
    const parent = byId.get(node.parent);
    assert.ok(parent);
    assert.ok(
      parent.step >= node.step,
      `부모가 자식보다 먼저 나온다: ${parent.id}(${parent.step}) → ${node.id}(${node.step})`,
    );
  }
});

test("블록 칸은 뜻을 크게, 블록 이름과 기술 이름을 함께 든다", () => {
  for (const node of TREE_NODES) {
    assert.ok(node.meaning.trim(), `뜻이 빈 블록: ${node.id}`);
    assert.ok(node.blockName.trim(), `블록 이름이 빈 블록: ${node.id}`);
    assert.ok(node.technical.trim(), `기술 이름이 빈 블록: ${node.id}`);
  }
});

test("트리에 쓴 블록 이름은 블록 목록에도 있다", () => {
  // 목록에 없는 블록이 그림에 나오면 "블록은 이게 전부" 라는 말이 거짓이 된다.
  const listed = new Set(
    BLOCK_GROUPS.flatMap((group) => group.blocks.map((block) => block.label)),
  );
  for (const node of TREE_NODES) {
    assert.ok(
      listed.has(node.blockName),
      `목록에 없는 블록이 그림에 있다: ${node.blockName}`,
    );
  }
});

test("다른 예시가 대는 블록도 목록에 있는 것뿐이다", () => {
  const listed = new Set(
    BLOCK_GROUPS.flatMap((group) => group.blocks.map((block) => block.label)),
  );
  assert.ok(OTHER_EXAMPLES.length > 0);
  for (const example of OTHER_EXAMPLES) {
    assert.ok(example.sentence.trim());
    assert.ok(example.blocks.length > 0, `블록을 안 댄 예시: ${example.sentence}`);
    for (const block of example.blocks) {
      assert.ok(listed.has(block), `목록에 없는 블록: ${block} (${example.sentence})`);
    }
  }
});

test("블록마다 무슨 일을 하는지 한마디가 붙어 있다", () => {
  // 이름만 늘어놓으면 목록이 아니라 낱말 벽이 된다.
  for (const group of BLOCK_GROUPS) {
    assert.ok(group.title.trim());
    assert.ok(group.blocks.length > 0, `빈 갈래: ${group.kind}`);
    for (const block of group.blocks) {
      assert.ok(block.label.trim());
      assert.ok(block.does.trim(), `하는 일이 빈 블록: ${block.label}`);
      assert.ok(block.technical.trim());
    }
  }
});

test("둘째 조각을 쌓는 순서가 네 단계로 적혀 있다", () => {
  // 「전용 기능이 아니라 조합」이라는 말은 순서를 보여 줘야 납득된다.
  assert.ok(ABSENCE_SEQUENCE.length >= 3);
  for (const item of ABSENCE_SEQUENCE) {
    assert.ok(item.text.trim());
    assert.ok(item.blockName.trim());
  }
});

test("부재 순서가 대는 블록은 그 단계에 실제로 나오는 블록과 같다", () => {
  // 화면이 이 순서 목록을 띄우는 단계는 `branchStep(ABSENCE_BRANCH)` 다. 그 단계에서 그림이
  // 내놓는 블록과 목록이 대는 블록이 어긋나면, 글로는 다섯 개를 쌓는다고 하고 그림은 다른
  // 것을 그린다. `branchStep` 이 `TREE_NODES` 에서 파생되므로 단계 번호 자체를 여기서 다시
  // 재지는 않는다 — 입력에서 파생된 경계로 그 입력을 검사할 수는 없다.
  const step = branchStep(ABSENCE_BRANCH);
  assert.ok(step >= 1, `부재 가지의 블록이 그림에 없다: ${ABSENCE_BRANCH}`);

  const appearing = new Set(
    TREE_NODES.filter(
      (node) => node.branch === ABSENCE_BRANCH && node.step === step,
    ).map((node) => node.blockName),
  );
  const named = new Set(
    ABSENCE_SEQUENCE.flatMap((item) =>
      item.blockName.split(" + ").map((part) => part.trim()),
    ),
  );
  assert.deepEqual(
    [...named].sort(),
    [...appearing].sort(),
    "순서 목록이 대는 블록과 그 단계에 나오는 블록이 다르다",
  );

  // 그 단계는 규칙이 하는 단계여야 한다 — 순서를 쌓는 것은 모델이 아니다.
  assert.equal(ASSEMBLY_STEPS[step - 1].actor, "program");
});

test("branchStep 은 그림에 없는 가지를 어떤 단계와도 짝짓지 않는다", () => {
  // 0 을 돌려주므로 `step === branchStep(...)` 은 어느 단계에서도 참이 되지 않는다.
  const inTree = new Set(TREE_NODES.map((node) => node.branch));
  for (const branch of ["root", "left", "right"] as const) {
    const step = branchStep(branch);
    if (inTree.has(branch)) {
      assert.ok(step >= 1 && step <= LAST_STEP, `범위 밖 단계: ${branch} → ${step}`);
    } else {
      assert.equal(step, 0, `없는 가지가 단계를 가졌다: ${branch}`);
    }
  }
});

test("2단계부터는 조립한 것을 말로 읽어 준다", () => {
  // 트리만 보고 "그래서 무슨 뜻인가" 를 스스로 옮기게 두지 않는다.
  assert.equal(ASSEMBLY_STEPS.length, LAST_STEP);
  assert.equal(ASSEMBLY_STEPS[0].readback, undefined, "1단계엔 아직 읽을 것이 없다");
  for (const step of ASSEMBLY_STEPS.slice(1)) {
    assert.ok(step.readback?.trim(), `읽어 주는 줄이 없는 단계: ${step.title}`);
  }
});

test("단계 설명과 문단이 비어 있지 않다", () => {
  for (const step of ASSEMBLY_STEPS) {
    assert.ok(step.title.trim());
    assert.ok(step.plain.trim());
  }
  assert.ok(EXAMPLE_REQUEST.trim());
  assert.ok(EXAMPLE_SQL.trim());
  assert.ok(EXAMPLE_SQL_NOTE.trim());
  assert.ok(TECHNICAL_NOTE.trim());
  for (const lines of [WHY_IT_MATTERS, IF_WE_DID_IT_THE_OTHER_WAY]) {
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.ok(line.trim());
    }
  }
});

test("AI 가 뜻을 고르는 단계는 하나뿐이고 선언에서 파생된다", () => {
  // 화면이 "AI 는 여기까지" 라고 말하려면 그 자리가 하나여야 한다. 둘이면 그 말이 거짓이 된다.
  const aiSteps = ASSEMBLY_STEPS.filter((step) => step.actor === "ai");
  assert.equal(aiSteps.length, 1, "AI 단계가 하나가 아니다");
  assert.equal(ASSEMBLY_STEPS[MODEL_STEP - 1], aiSteps[0], "MODEL_STEP 이 AI 단계를 안 가리킨다");
  assert.ok(MODEL_STEP >= 1 && MODEL_STEP <= LAST_STEP);
});

test("모델 단계까지는 블록이 하나도 나오지 않는다", () => {
  // 이 화면의 주장 자체다 — 모델은 블록을 고르지 않는다. 모델 단계에서 블록이 하나라도
  // 늘어나면 그림이 그 반대를 말하게 된다.
  assert.equal(nodesUpTo(MODEL_STEP).length, 0, "모델 단계에 블록이 있다");
  assert.equal(assembledBranches(MODEL_STEP).size, 0);
});

test("블록이 나타나는 단계는 전부 정해진 규칙이 한다", () => {
  // 어느 블록이든 AI 단계에 붙어 있으면 "블록은 규칙이 고른다" 는 말이 그 블록에서 깨진다.
  for (const node of TREE_NODES) {
    const step = ASSEMBLY_STEPS[node.step - 1];
    assert.ok(step, `없는 단계를 가리킨다: ${node.id} → ${node.step}`);
    assert.equal(
      step.actor,
      "program",
      `AI 단계에 매달린 블록: ${node.id} (${node.step}단계)`,
    );
  }
});

test("모든 단계의 행위자가 선언돼 있다", () => {
  for (const step of ASSEMBLY_STEPS) {
    const actor = ACTORS[step.actor];
    assert.ok(actor, `선언 없는 행위자: ${step.actor}`);
    assert.ok(actor.label.trim());
    assert.ok(actor.note.trim());
  }
});

test("대응표가 그림의 블록을 가지별로 정확히 덮는다", () => {
  // 표에만 있는 블록은 그림에 없는 것을 그림이 낸다고 말하는 것이고, 그림에만 있는 블록은
  // "이 뜻에서 이 블록들이 나온다" 는 설명에서 빠진 블록이다. 둘 다 조용한 거짓말이다.
  for (const row of MEANING_TO_BLOCKS) {
    const inTree = new Set(
      TREE_NODES.filter((node) => node.branch === row.branch).map((node) => node.blockName),
    );
    assert.deepEqual(
      [...row.blocks].sort(),
      [...inTree].sort(),
      `대응표와 그림이 어긋난 가지: ${row.branch}`,
    );
  }
  const covered = new Set(MEANING_TO_BLOCKS.map((row) => row.branch));
  const inTree = new Set(TREE_NODES.map((node) => node.branch));
  assert.deepEqual([...covered].sort(), [...inTree].sort(), "대응표가 빠뜨린 가지가 있다");
});

test("고른 뜻보다 나온 블록이 많다", () => {
  // 이 표가 말하려는 전부다. 뜻 하나가 블록 하나씩이면 "모델이 블록을 골랐다" 와 구별되지 않는다.
  const blocks = MEANING_TO_BLOCKS.reduce((sum, row) => sum + row.blocks.length, 0);
  assert.ok(
    blocks > MEANING_TO_BLOCKS.length,
    `뜻 ${MEANING_TO_BLOCKS.length}개에 블록 ${blocks}개 — 펼쳐지지 않았다`,
  );
  assert.ok(
    MEANING_TO_BLOCKS.some((row) => row.blocks.length > 1),
    "한 뜻이 여러 블록으로 펼쳐지는 예가 없다",
  );
});

test("대응표가 대는 블록도 목록에 있는 것뿐이다", () => {
  const listed = new Set(
    BLOCK_GROUPS.flatMap((group) => group.blocks.map((block) => block.label)),
  );
  for (const row of MEANING_TO_BLOCKS) {
    assert.ok(row.piece.trim());
    assert.ok(row.meaning.trim());
    assert.ok(row.technical.trim());
    assert.ok(row.blocks.length > 0, `블록을 안 댄 뜻: ${row.meaning}`);
    for (const block of row.blocks) {
      assert.ok(listed.has(block), `목록에 없는 블록: ${block} (${row.meaning})`);
    }
  }
});

test("대응표가 가리키는 조각은 원래 문장에 있는 말이다", () => {
  // 문장에 없는 말을 조각이라고 적으면, 읽는 사람이 위에 띄운 문장에서 그것을 찾지 못한다.
  const colored = new Set(
    SENTENCE_PARTS.flatMap((part) => (part.branch ? [part.text] : [])),
  );
  for (const row of MEANING_TO_BLOCKS) {
    if (row.branch === "root") continue; // 뿌리는 두 조각을 함께 말한 자리라 인용할 낱말이 없다
    assert.ok(
      colored.has(row.piece),
      `문장에 색칠되지 않은 조각: ${row.piece}`,
    );
  }
});

test("모델에게 보내는 것과 받는 것이 항목마다 채워져 있다", () => {
  for (const side of [MODEL_EXCHANGE.sends, MODEL_EXCHANGE.returns]) {
    assert.ok(side.length > 0);
    for (const item of side) {
      assert.ok(item.label.trim(), "이름이 빈 항목");
      assert.ok(item.detail.trim(), `설명이 빈 항목: ${item.label}`);
      assert.ok(item.technical.trim(), `기술 이름이 빈 항목: ${item.label}`);
    }
  }
});

test("모델이 낼 수 없는 것과 프로그램이 검사하는 것이 둘 다 적혀 있다", () => {
  // 한쪽만 적으면 경계가 반쪽이 된다 — 못 내는 것만 적으면 무엇을 믿고 통과시키는지 모르고,
  // 검사만 적으면 애초에 올 수 없는 것이 검사로 막히는 것처럼 읽힌다.
  for (const lines of [MODEL_CANNOT, PROGRAM_CHECKS, OFF_MENU]) {
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.ok(line.trim());
    }
  }
  assert.ok(MAPPING_NOTE.trim());
});

test("사슬 그림의 AI 칸은 하나이고, 그 앞뒤는 프로그램 칸이다", () => {
  // 이 그림의 주장이 곧 이 불변식이다. AI 칸이 둘이면 "한 칸" 이라는 말이 거짓이고,
  // 앞에 목록을 주는 칸이 없으면 모델이 아무것이나 고르는 그림이 되고, 뒤에 대조하는 칸이
  // 없으면 고른 것이 그대로 실행되는 그림이 된다.
  const aiAt = BOUNDARY_FLOW.map((cell, index) => ({ cell, index })).filter(
    ({ cell }) => cell.lane === "ai",
  );
  assert.equal(aiAt.length, 1, "AI 칸이 하나가 아니다");

  const at = aiAt[0].index;
  assert.ok(at > 0, "AI 칸 앞에 칸이 없다");
  assert.ok(at < BOUNDARY_FLOW.length - 1, "AI 칸 뒤에 칸이 없다");
  assert.equal(BOUNDARY_FLOW[at - 1].lane, "program", "AI 칸 앞이 프로그램 칸이 아니다");
  assert.equal(BOUNDARY_FLOW[at + 1].lane, "program", "AI 칸 뒤가 프로그램 칸이 아니다");
});

test("사슬 그림은 사용자 칸에서 시작한다", () => {
  // 사용자 칸이 중간에 있으면 문장이 어디서 들어오는지 알 수 없다.
  assert.equal(BOUNDARY_FLOW[0].lane, "user");
  assert.equal(
    BOUNDARY_FLOW.filter((cell) => cell.lane === "user").length,
    1,
    "사용자 칸이 하나가 아니다",
  );
});

test("사슬 칸마다 이름과 한 줄이 채워져 있다", () => {
  // 그림 안의 글이라 비면 빈 상자가 그려진다.
  assert.ok(BOUNDARY_FLOW.length >= 3);
  for (const cell of BOUNDARY_FLOW) {
    assert.ok(cell.label.trim(), "이름이 빈 칸");
    assert.ok(cell.note.trim(), `한 줄이 빈 칸: ${cell.label}`);
    if (cell.lane === "user") {
      // 사용자가 쓴 문장에는 기술 이름이 없다 — 있으면 시스템의 칸처럼 읽힌다.
      assert.equal(cell.technical, null, "사용자 칸에 기술 이름이 붙었다");
    } else {
      assert.ok(cell.technical?.trim(), `기술 이름이 빈 칸: ${cell.label}`);
    }
  }
  assert.ok(BOUNDARY_FLOW_NOTE.trim());
});

test("사슬 칸의 갈래는 선언된 행위자이거나 사용자뿐이다", () => {
  // 화면이 갈래별로 색을 고르므로, 선언 밖의 갈래가 오면 색 없는 칸이 그려진다.
  for (const cell of BOUNDARY_FLOW) {
    if (cell.lane === "user") continue;
    assert.ok(ACTORS[cell.lane], `선언 없는 갈래: ${cell.lane}`);
  }
});
