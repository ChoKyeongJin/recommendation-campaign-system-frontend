import assert from "node:assert/strict";
import test from "node:test";

import {
  ABSENCE_SEQUENCE,
  ASSEMBLY_STEPS,
  assembledBranches,
  BLOCK_GROUPS,
  edgesUpTo,
  EXAMPLE_REQUEST,
  EXAMPLE_SQL,
  EXAMPLE_SQL_NOTE,
  IF_WE_DID_IT_THE_OTHER_WAY,
  LAST_STEP,
  nodesUpTo,
  OTHER_EXAMPLES,
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
  // 2단계 설명은 「여성」을, 3단계 설명은 「구매하지 않은」을 만든다고 말한다.
  // 실제 조립 순서가 그와 어긋나면 설명과 그림이 따로 논다.
  assert.deepEqual([...assembledBranches(2)].sort(), ["left"]);
  assert.deepEqual([...assembledBranches(3)].sort(), ["left", "right"]);
  assert.deepEqual([...assembledBranches(4)].sort(), ["left", "right", "root"]);
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
