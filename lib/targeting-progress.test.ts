import assert from "node:assert/strict";
import test from "node:test";

import {
  getTargetingResponseTransport,
  initialTargetingProgressState,
  isTargetingStreamEvent,
  NdjsonParser,
  reduceTargetingProgress,
  TARGETING_PROGRESS_STAGES,
  TargetingStreamContract,
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
