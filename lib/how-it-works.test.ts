import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_BOUNDARY,
  CALL_BUDGET,
  FAIL_CLOSE,
  failCloseIndex,
  LLM_EXCHANGE,
  llmStageIndex,
  PIPELINE_STAGES,
  stageAtProgress,
} from "./how-it-works.ts";

test("진행도 0 은 첫 단계 위에 머문다", () => {
  assert.deepEqual(stageAtProgress(0, 6), { index: 0, travel: 0 });
});

test("진행도 1 은 마지막 단계 위에 머문다", () => {
  assert.deepEqual(stageAtProgress(1, 6), { index: 5, travel: 0 });
});

test("범위를 벗어난 진행도는 양 끝으로 잘린다", () => {
  // 애니메이션 프레임이 한 번 건너뛰면 1 을 넘는 값이 들어온다. 그때 표시가
  // 트랙 밖으로 나가면 안 된다.
  assert.deepEqual(stageAtProgress(-3, 6), { index: 0, travel: 0 });
  assert.deepEqual(stageAtProgress(7.5, 6), { index: 5, travel: 0 });
  assert.deepEqual(stageAtProgress(Number.NaN, 6), { index: 0, travel: 0 });
});

test("각 단계의 앞부분은 머물고 뒷부분에만 이동한다", () => {
  // 쉬지 않고 흐르면 어느 단계를 읽어야 할지 알 수 없다.
  const slot = 1 / 6;
  assert.deepEqual(stageAtProgress(slot * 0.1, 6), { index: 0, travel: 0 });
  assert.deepEqual(stageAtProgress(slot * 0.55, 6), { index: 0, travel: 0 });

  const moving = stageAtProgress(slot * 0.775, 6);
  assert.equal(moving.index, 0);
  assert.ok(moving.travel > 0.49 && moving.travel < 0.51, `travel=${moving.travel}`);

  const arriving = stageAtProgress(slot * 0.999, 6);
  assert.equal(arriving.index, 0);
  assert.ok(arriving.travel > 0.99, `travel=${arriving.travel}`);
});

test("단계 경계를 넘으면 다음 단계에 머문다", () => {
  assert.deepEqual(stageAtProgress(1 / 6, 6), { index: 1, travel: 0 });
  assert.deepEqual(stageAtProgress(3 / 6, 6), { index: 3, travel: 0 });
});

test("마지막 단계는 갈 곳이 없어 이동하지 않는다", () => {
  // 이동값이 남으면 표시가 트랙 오른쪽 끝을 넘어 그려진다.
  for (const progress of [5 / 6, 0.9, 0.99]) {
    assert.deepEqual(
      stageAtProgress(progress, 6),
      { index: 5, travel: 0 },
      `progress=${progress}`,
    );
  }
});

test("단계 수가 말이 안 되면 첫 단계로 둔다", () => {
  for (const count of [0, -1, Number.NaN]) {
    assert.deepEqual(stageAtProgress(0.5, count), { index: 0, travel: 0 });
  }
});

test("단계 하나짜리도 트랙 밖으로 나가지 않는다", () => {
  assert.deepEqual(stageAtProgress(0.5, 1), { index: 0, travel: 0 });
  assert.deepEqual(stageAtProgress(1, 1), { index: 0, travel: 0 });
});

test("모델을 부르는 단계와 막히는 단계가 실재한다", () => {
  // 백엔드 단계 이름을 고치면서 여기를 안 고치면 -1 이 되고, 그러면 그림에서
  // 호출 표시가 조용히 사라진다.
  assert.ok(llmStageIndex() >= 0, "모델 호출 단계를 못 찾았다");
  assert.ok(failCloseIndex() >= 0, "막히는 단계를 못 찾았다");
});

test("여섯 단계가 저마다 라벨·설명·원리를 들고 있고 id 가 겹치지 않는다", () => {
  assert.equal(PIPELINE_STAGES.length, 6);
  const ids = new Set<string>();
  for (const stage of PIPELINE_STAGES) {
    assert.ok(stage.label.trim(), `라벨이 빈 단계: ${stage.id}`);
    assert.ok(stage.description.trim(), `설명이 빈 단계: ${stage.id}`);
    assert.ok(stage.principle.trim(), `원리가 빈 단계: ${stage.id}`);
    assert.equal(ids.has(stage.id), false, `중복된 단계 id: ${stage.id}`);
    ids.add(stage.id);
  }
});

test("설명 문단이 비어 있지 않다", () => {
  // 한 칸이라도 비면 화면에 제목만 남은 상자가 생긴다.
  for (const [name, lines] of [
    ["보내는 것", LLM_EXCHANGE.sends],
    ["돌려받는 것", LLM_EXCHANGE.returns],
    ["호출 횟수", CALL_BUDGET],
    ["모델이 정하는 것", AUTHORITY_BOUNDARY.model],
    ["프로그램이 정하는 것", AUTHORITY_BOUNDARY.program],
    ["막히면", FAIL_CLOSE],
  ] as const) {
    assert.ok(lines.length > 0, `${name} 이 비었다`);
    for (const line of lines) {
      assert.ok(line.trim(), `${name} 에 빈 줄이 있다`);
    }
  }
});
