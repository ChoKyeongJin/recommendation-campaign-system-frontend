import assert from "node:assert/strict";
import test from "node:test";

import {
  asForwardableTargetingEvent,
  describeTargetingAccounting,
  getTargetingResponseTransport,
  initialTargetingProgressState,
  isTargetingStreamEvent,
  NdjsonParser,
  reduceTargetingProgress,
  TARGETING_PROGRESS_STAGES,
  TargetingStreamContract,
  type TargetingLlmAccountingEvent,
  type TargetingLlmCallEvent,
  type TargetingProgressEvent,
} from "./targeting-progress.ts";

test("targeting response transport accepts only declared media types", () => {
  assert.equal(
    getTargetingResponseTransport("application/x-ndjson; charset=utf-8"),
    "ndjson",
  );
  assert.equal(getTargetingResponseTransport("Application/JSON"), "json");
  assert.equal(getTargetingResponseTransport("text/html"), "unsupported");
  assert.equal(getTargetingResponseTransport(null), "unsupported");
});

const progress = (
  sequence: number,
  stage: TargetingProgressEvent["stage"] = "request_analysis",
): TargetingProgressEvent => ({
  type: "progress",
  request_id: "request-1",
  sequence,
  stage,
  order: TARGETING_PROGRESS_STAGES.indexOf(stage) + 1,
  total: TARGETING_PROGRESS_STAGES.length,
  label: stage,
  description: `${stage} description`,
  status: sequence === 1 ? "started" : "completed",
  elapsed_ms: sequence * 10,
});

test("NDJSON parser handles fragmented and multiple lines", () => {
  const parser = new NdjsonParser();
  assert.deepEqual(parser.push('{"type":"progress","sequence":1'), []);
  assert.deepEqual(parser.push('}\n{"type":"result","sequence":2}\n'), [
    { type: "progress", sequence: 1 },
    { type: "result", sequence: 2 },
  ]);
  assert.deepEqual(parser.finish(), []);

  const trailingParser = new NdjsonParser();
  assert.deepEqual(trailingParser.push('{"type":"result","sequence":3}'), []);
  assert.deepEqual(trailingParser.finish(), [
    { type: "result", sequence: 3 },
  ]);
});

test("progress reducer orders stages and ignores stale or foreign events", () => {
  let state = reduceTargetingProgress(
    initialTargetingProgressState,
    progress(2, "semantic_resolution"),
  );
  state = reduceTargetingProgress(state, progress(3, "request_analysis"));
  state = reduceTargetingProgress(state, progress(1, "sql_compilation"));
  state = reduceTargetingProgress(state, {
    ...progress(4),
    request_id: "foreign",
  });
  assert.deepEqual(state.stages.map((item) => item.stage), [
    "request_analysis",
    "semantic_resolution",
  ]);
  assert.equal(state.lastSequence, 3);
});

test("terminal result and error stop later updates", () => {
  const result = {
    type: "result" as const,
    request_id: "request-1",
    sequence: 2,
    data: { ok: true },
  };
  let state = reduceTargetingProgress(
    reduceTargetingProgress(initialTargetingProgressState, progress(1)),
    result,
  );
  assert.equal(state.terminal, result);
  assert.equal(reduceTargetingProgress(state, progress(3)), state);

  const error = {
    type: "error" as const,
    request_id: "request-2",
    sequence: 1,
    error: { status: 500, code: "failed", message: "failed" },
  };
  state = reduceTargetingProgress(initialTargetingProgressState, error);
  assert.equal(state.terminal, error);
});

test("a failed stage remains available after the terminal error", () => {
  const failedStage = {
    ...progress(1, "semantic_resolution"),
    status: "failed" as const,
  };
  const terminalError = {
    type: "error" as const,
    request_id: "request-1",
    sequence: 2,
    error: { status: 500, code: "failed", message: "failed" },
  };
  const state = reduceTargetingProgress(
    reduceTargetingProgress(initialTargetingProgressState, failedStage),
    terminalError,
  );

  assert.equal(state.stages[0], failedStage);
  assert.equal(state.terminal, terminalError);
});

test("terminal events require the complete typed contract", () => {
  assert.equal(
    isTargetingStreamEvent({
      type: "error",
      request_id: "request-1",
      sequence: 1,
      error: { status: 500, code: "failed", message: "failed" },
    }),
    true,
  );
  assert.equal(
    isTargetingStreamEvent({
      type: "error",
      request_id: "request-1",
      sequence: 1,
      error: { message: "failed" },
    }),
    false,
  );
  assert.equal(
    isTargetingStreamEvent({
      type: "result",
      request_id: "request-1",
      sequence: 1,
      data: null,
    }),
    false,
  );
});

test("progress events reject undeclared stages and invalid counters", () => {
  const valid = progress(1);
  assert.equal(isTargetingStreamEvent(valid), true);
  assert.equal(
    isTargetingStreamEvent({ ...valid, stage: "invented_stage" }),
    false,
  );
  assert.equal(isTargetingStreamEvent({ ...valid, sequence: 0 }), false);
  assert.equal(isTargetingStreamEvent({ ...valid, elapsed_ms: -1 }), false);
  assert.equal(isTargetingStreamEvent({ ...valid, order: 2 }), false);
  assert.equal(isTargetingStreamEvent({ ...valid, total: 7 }), false);
});

test("stream contract fails closed on malformed or inconsistent events", () => {
  const contract = new TargetingStreamContract();
  const first = progress(1);
  assert.equal(contract.accept(first), first);
  assert.equal(contract.requestId, "request-1");
  assert.equal(contract.nextSequence, 2);
  assert.equal(contract.accept({ ...progress(2), request_id: "foreign" }), null);
  assert.equal(contract.accept(progress(1)), null);
  assert.equal(contract.accept(progress(999, "semantic_resolution")), null);
  assert.equal(
    contract.accept({
      type: "result",
      request_id: "request-1",
      sequence: 2,
    }),
    null,
  );

  const terminal = {
    type: "result" as const,
    request_id: "request-1",
    sequence: 2,
    data: { ok: true },
  };
  assert.equal(contract.accept(terminal), terminal);
  assert.equal(contract.hasTerminal, true);
  assert.equal(contract.accept(progress(3, "semantic_resolution")), null);
});

test("LLM call events are observations, not terminals", () => {
  const llmCall = (
    sequence: number,
    status: TargetingLlmCallEvent["status"],
  ): TargetingLlmCallEvent => ({
    type: "llm_call",
    request_id: "request-1",
    sequence,
    call_id: 1,
    stage: "request_analysis",
    purpose: "typo_correction",
    label: "오타 교정",
    model: "gpt-5-mini",
    reasoning_effort: "low",
    status,
    elapsed_ms: status === "started" ? 0 : 1200,
  });
  const started = llmCall(2, "started");
  assert.equal(isTargetingStreamEvent({ ...started, call_id: 0 }), false);
  assert.equal(isTargetingStreamEvent({ ...started, stage: "invented" }), false);
  assert.equal(isTargetingStreamEvent({ ...started, stage: null, purpose: null }), true);

  const contract = new TargetingStreamContract();
  let state = initialTargetingProgressState;
  for (const event of [progress(1), started, llmCall(3, "completed")]) {
    const accepted = contract.accept(event);
    assert.notEqual(accepted, null);
    state = reduceTargetingProgress(state, accepted!);
  }
  assert.equal(contract.hasTerminal, false);
  assert.deepEqual(
    state.llmCalls.map((call) => [call.call_id, call.status, call.elapsed_ms]),
    [[1, "completed", 1200]],
  );
  assert.equal(state.stages.length, 1);
});

test("깊이는 있으면 문자열, 없으면 없음이다 — 그 때문에 줄이 사라지지 않는다", () => {
  // 옛 백엔드는 이 칸을 안 싣는다. 여기서 막으면 배포가 엇갈린 동안 진행 줄이 통째로
  // 안 뜨고, 사용자는 요청이 멈춘 것처럼 본다.
  const base: TargetingLlmCallEvent = {
    type: "llm_call",
    request_id: "request-1",
    sequence: 2,
    call_id: 1,
    stage: "semantic_resolution",
    purpose: "semantic_candidate",
    label: "의미 후보 구조화",
    model: "gpt-5.5",
    reasoning_effort: "high",
    status: "completed",
    elapsed_ms: 15000,
  };
  assert.equal(isTargetingStreamEvent(base), true);
  assert.equal(isTargetingStreamEvent({ ...base, reasoning_effort: null }), true);

  const { reasoning_effort: _omitted, ...withoutDepth } = base;
  assert.equal(isTargetingStreamEvent(withoutDepth), true, "옛 백엔드의 줄이 막혔다");

  // 모양이 아닌 값은 받지 않는다 — 화면이 그대로 찍는 자리다.
  assert.equal(isTargetingStreamEvent({ ...base, reasoning_effort: 3 }), false);
  assert.equal(isTargetingStreamEvent({ ...base, reasoning_effort: {} }), false);
});


// ── 회계 사건 ────────────────────────────────────────────────────────────────

const accounting = (
  sequence: number,
  overrides: Partial<TargetingLlmAccountingEvent> = {},
): TargetingLlmAccountingEvent => ({
  type: "llm_accounting",
  request_id: "request-1",
  sequence,
  calls: 2,
  measured_calls: 2,
  unmeasured_calls: 0,
  input_tokens: 58_351,
  output_tokens: 1_884,
  reasoning_tokens: 1_564,
  cache: {
    reported_calls: 2,
    input_tokens: 58_351,
    cached_input_tokens: 47_616,
    uncached_input_tokens: 10_735,
    hit_ratio: 0.816,
  },
  cost: {
    status: "priced",
    priced_calls: 2,
    unpriced_models: [],
    rejected_declarations: [],
    complete: true,
    usd: 0.050537,
    without_cache_usd: 0.125532,
    saved_usd: 0.074995,
    saved_ratio: 0.5974,
  },
  by_model: [],
  ...overrides,
});

test("an unknown event type does not tear down the stream", () => {
  // 실제로 이렇게 났다: 백엔드가 `llm_accounting` 을 더했을 때 화면은 닫힌 목록으로 그것을
  // 거절했고, 순번을 전진시키지 않아 **바로 뒤의 terminal 까지** 어긋나 프록시가
  // `upstream_stream_contract_invalid` 로 스트림을 끊었다. 그래서 새 사건 하나가 요청을
  // 통째로 잃게 만들었다.
  const contract = new TargetingStreamContract();
  assert.ok(contract.accept(progress(1)));
  const surprise = contract.accept({
    type: "something_new_the_screen_has_not_seen",
    request_id: "request-1",
    sequence: 2,
  });
  assert.ok(surprise, "모르는 사건이 거절되면 그 뒤가 전부 어긋난다");
  const terminal = contract.accept({
    type: "result",
    request_id: "request-1",
    sequence: 3,
    data: {},
  });
  assert.ok(terminal, "모르는 사건 뒤의 terminal 이 순번 때문에 버려졌다");
  assert.equal(terminal.type, "result");
  assert.ok(contract.hasTerminal);
});

test("a known event type with a broken shape is still refused", () => {
  // 「모르는 종류」와 「아는 종류인데 모양이 틀림」은 다른 사실이다. 뒤쪽은 백엔드 결함이므로
  // 관대하게 흘리면 화면이 빈 칸을 0 으로 그린다.
  const contract = new TargetingStreamContract();
  assert.equal(
    contract.accept({
      type: "llm_accounting",
      request_id: "request-1",
      sequence: 1,
      calls: "두 번",
    }),
    null,
  );
});

test("the accounting event is validated and reduced once", () => {
  assert.equal(isTargetingStreamEvent(accounting(1)), true);
  const state = reduceTargetingProgress(
    initialTargetingProgressState,
    accounting(1),
  );
  assert.equal(state.accounting?.cache.cached_input_tokens, 47_616);
  assert.equal(state.lastSequence, 1);
  assert.equal(state.terminal, null, "회계는 terminal 이 아니다");
});

test("an accounting event without its cache or cost block is refused", () => {
  const { cache: _cache, ...withoutCache } = accounting(1);
  assert.equal(isTargetingStreamEvent(withoutCache), false);
});

test("an unknown event advances the sequence without drawing anything", () => {
  const state = reduceTargetingProgress(initialTargetingProgressState, {
    type: "future_event",
    request_id: "request-1",
    sequence: 1,
  });
  assert.equal(state.lastSequence, 1);
  assert.deepEqual(state.stages, []);
  assert.equal(state.accounting, null);
});

// ── 문구 ─────────────────────────────────────────────────────────────────────

test("the cache share and the saved share are never printed as one number", () => {
  // 캐시된 입력은 캐시 단가로 청구되고 출력은 정가이므로 절감률은 언제나 적중률보다 작다.
  // 토큰 비를 절감률 칸에 적으면 절감을 과장한다.
  const summary = describeTargetingAccounting(accounting(1));
  assert.match(summary.cache ?? "", /81\.6%/);
  assert.match(summary.saved ?? "", /59\.7%/);
  assert.ok(!summary.saved?.includes("81.6%"));
  assert.equal(summary.cost, "$0.0505");
  assert.equal(summary.caveat, null);
});

test("no declared price means no money on screen, not zero", () => {
  const summary = describeTargetingAccounting(
    accounting(1, {
      cost: {
        status: "undeclared",
        priced_calls: 0,
        unpriced_models: [],
        rejected_declarations: [],
        complete: false,
      },
    }),
  );
  assert.equal(summary.cost, null, "0 원으로 적으면 공짜로 보인다");
  assert.equal(summary.saved, null);
  assert.match(summary.caveat ?? "", /단가 선언 없음/);
  // 단가가 없어도 적중은 관측된다.
  assert.match(summary.cache ?? "", /47,616/);
});

test("a sum that does not cover the request is printed as a floor", () => {
  const summary = describeTargetingAccounting(
    accounting(1, {
      calls: 3,
      measured_calls: 2,
      unmeasured_calls: 1,
      cost: {
        status: "priced",
        priced_calls: 2,
        unpriced_models: ["gpt-unknown"],
        rejected_declarations: ["m-bad=1/2"],
        complete: false,
        usd: 0.05,
        without_cache_usd: 0.12,
        saved_usd: 0.07,
        saved_ratio: 0.58,
      },
    }),
  );
  assert.match(summary.cost ?? "", /^최소 /, "바닥값을 총액으로 적으면 안 된다");
  assert.match(summary.caveat ?? "", /사용량 미측정 1회/);
  assert.match(summary.caveat ?? "", /단가 미선언 gpt-unknown/);
  assert.match(summary.caveat ?? "", /읽을 수 없는 단가 선언 1건/);
});

test("a request with no cache measurement says nothing about the cache", () => {
  const summary = describeTargetingAccounting(
    accounting(1, {
      cache: {
        reported_calls: 0,
        input_tokens: 0,
        cached_input_tokens: 0,
        uncached_input_tokens: 0,
        hit_ratio: null,
      },
    }),
  );
  assert.equal(summary.cache, null, "재지 못한 것을 0% 로 적으면 안 된다");
});

test("a request that bought nothing shows no saving line", () => {
  const summary = describeTargetingAccounting(
    accounting(1, {
      cache: {
        reported_calls: 2,
        input_tokens: 58_351,
        cached_input_tokens: 0,
        uncached_input_tokens: 58_351,
        hit_ratio: 0,
      },
      cost: {
        status: "priced",
        priced_calls: 2,
        unpriced_models: [],
        rejected_declarations: [],
        complete: true,
        usd: 0.1255,
        without_cache_usd: 0.1255,
        saved_usd: 0,
        saved_ratio: 0,
      },
    }),
  );
  assert.equal(summary.saved, null, "0 절감을 초록 글씨로 적으면 안 된다");
  assert.match(summary.cache ?? "", /0\.0%/);
});


/**
 * python `POST /target-sql/stream` 이 **실제로 낸** 회계 사건(2026-09-29 실측, 구조화 1회 +
 * 교정 1회 + usage 미보고 1회). 손으로 적은 표본은 백엔드를 안 보고도 통과하므로, 두 저장소의
 * 필드 이름이 어긋나면 시험은 초록인데 화면만 빈다. 그래서 낸 것을 그대로 고정한다.
 */
const BACKEND_PAYLOAD = {
  type: "llm_accounting",
  request_id: "f346543227b9441ca28b6f4d22ad5d97",
  sequence: 9,
  calls: 3,
  measured_calls: 2,
  unmeasured_calls: 1,
  input_tokens: 58351,
  output_tokens: 1884,
  reasoning_tokens: 1564,
  cache: {
    reported_calls: 2,
    input_tokens: 58351,
    cached_input_tokens: 47616,
    uncached_input_tokens: 10735,
    hit_ratio: 0.816,
  },
  cost: {
    status: "priced",
    priced_calls: 2,
    unpriced_models: [],
    rejected_declarations: [],
    complete: false,
    usd: 0.050537,
    without_cache_usd: 0.125532,
    saved_usd: 0.074995,
    saved_ratio: 0.5974,
  },
  by_model: [
    {
      model: "gpt-5.2",
      calls: 2,
      unmeasured_calls: 1,
      input_tokens: 57147,
      cached_input_tokens: 47616,
      output_tokens: 1788,
      cost_usd: 0.050044,
    },
    {
      model: "gpt-5-mini",
      calls: 1,
      unmeasured_calls: 0,
      input_tokens: 1204,
      cached_input_tokens: 0,
      output_tokens: 96,
      cost_usd: 0.000493,
    },
  ],
} as const;

test("the payload the backend actually sends reaches the screen intact", () => {
  const event = asForwardableTargetingEvent(
    JSON.parse(JSON.stringify(BACKEND_PAYLOAD)),
  );
  assert.ok(event, "화면 계약이 백엔드 payload 를 거절했다 — 필드가 어긋났다");
  assert.equal(event.type, "llm_accounting");
  const state = reduceTargetingProgress(initialTargetingProgressState, event);
  assert.ok(state.accounting, "reducer 가 회계를 담지 않았다");
  const summary = describeTargetingAccounting(state.accounting);
  assert.equal(summary.cache, "캐시 47,616/58,351 토큰 (81.6%)");
  // 미측정 호출이 하나 있으므로 이 합계는 총액이 아니라 바닥값이다.
  assert.equal(summary.cost, "최소 $0.0505");
  assert.equal(summary.saved, "요금 59.7% 절감 (캐시 없이 $0.1255)");
  assert.equal(summary.caveat, "사용량 미측정 1회");
});
