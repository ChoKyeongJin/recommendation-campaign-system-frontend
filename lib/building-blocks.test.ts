import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSEMBLY_STEPS,
  BLOCK_GROUPS,
  edgesUpTo,
  EXAMPLE_REQUEST,
  EXAMPLE_SQL,
  EXAMPLE_SQL_NOTE,
  LAST_STEP,
  nodesUpTo,
  OTHER_EXAMPLES,
  TECHNICAL_NOTE,
  TREE_NODES,
  WHY_IT_MATTERS,
} from "./building-blocks.ts";

test("첫 단계에는 아직 블록이 없다", () => {
  // 1단계는 문장을 조각으로 나누는 자리다. 트리가 먼저 나오면 순서가 뒤집힌다.
  assert.equal(nodesUpTo(1).length, 0);
  assert.equal(edgesUpTo(1).length, 0);
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

test("마지막 단계에는 트리의 모든 블록이 나와 있다", () => {
  const shown = new Set(nodesUpTo(LAST_STEP).map((node) => node.id));
  for (const node of TREE_NODES) {
    assert.ok(shown.has(node.id), `끝까지 안 나오는 블록: ${node.id}`);
  }
});

test("선은 양쪽 블록이 둘 다 보일 때만 그린다", () => {
  // 한쪽만 보일 때 그리면 허공에 매달린 선이 생긴다.
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

test("자식은 부모보다 먼저 사라지지 않는다", () => {
  // 부모가 먼저 나오고 자식이 나중에 나오면, 그 사이 단계에서 선이 끊겨 보인다.
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

test("블록마다 쉬운 이름과 기술 이름을 함께 든다", () => {
  for (const node of TREE_NODES) {
    assert.ok(node.label.trim(), `이름이 빈 블록: ${node.id}`);
    assert.ok(node.detail.trim(), `설명이 빈 블록: ${node.id}`);
    assert.ok(node.technical.trim(), `기술 이름이 빈 블록: ${node.id}`);
  }
});

test("트리에 쓴 블록은 블록 목록에도 있다", () => {
  // 목록에 없는 블록이 그림에 나오면 "블록은 이게 전부" 라는 말이 거짓이 된다.
  const listed = new Set(
    BLOCK_GROUPS.flatMap((group) => group.blocks.map((block) => block.label)),
  );
  for (const node of TREE_NODES) {
    assert.ok(listed.has(node.label), `목록에 없는 블록이 그림에 있다: ${node.label}`);
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

test("단계 설명과 문단이 비어 있지 않다", () => {
  assert.equal(ASSEMBLY_STEPS.length, LAST_STEP);
  for (const step of ASSEMBLY_STEPS) {
    assert.ok(step.title.trim());
    assert.ok(step.plain.trim());
  }
  assert.ok(EXAMPLE_REQUEST.trim());
  assert.ok(EXAMPLE_SQL.trim());
  assert.ok(EXAMPLE_SQL_NOTE.trim());
  assert.ok(TECHNICAL_NOTE.trim());
  assert.ok(WHY_IT_MATTERS.length > 0);
  for (const line of WHY_IT_MATTERS) {
    assert.ok(line.trim());
  }
});
