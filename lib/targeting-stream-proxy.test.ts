import assert from "node:assert/strict";
import test from "node:test";

import { createTargetingProxyStream } from "./targeting-stream-proxy.ts";

const encoder = new TextEncoder();

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 500): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("stream did not finish after its terminal event")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readNdjson(
  stream: ReadableStream<Uint8Array>,
): Promise<Record<string, unknown>[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

test("proxy forwards a terminal result without waiting for upstream EOF", async () => {
  const progress = JSON.stringify({
    type: "progress",
    request_id: "request-1",
    sequence: 1,
    stage: "request_analysis",
    order: 1,
    total: 6,
    label: "요청 분석",
    description: "요청을 분석합니다.",
    status: "completed",
    elapsed_ms: 10,
  });
  const result = JSON.stringify({
    type: "result",
    request_id: "request-1",
    sequence: 2,
    data: { raw: true },
  });
  const payload = `${progress}\n${result}\n`;
  let upstreamCancelled = false;

  const upstream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split inside the first line and deliberately leave the stream open.
      controller.enqueue(encoder.encode(payload.slice(0, 17)));
      controller.enqueue(encoder.encode(payload.slice(17)));
    },
    cancel() {
      upstreamCancelled = true;
      return new Promise<void>(() => undefined);
    },
  });

  const events = await withTimeout(
    readNdjson(
      createTargetingProxyStream(upstream, () => ({ mapped: true })),
    ),
  );

  assert.deepEqual(events.map((event) => event.type), ["progress", "result"]);
  assert.deepEqual(events[1]?.data, { mapped: true });
  assert.equal(upstreamCancelled, true);
});

test("result mapping failure emits the next sequence visible to the client", async () => {
  const progress = JSON.stringify({
    type: "progress",
    request_id: "request-2",
    sequence: 1,
    stage: "request_analysis",
    order: 1,
    total: 6,
    label: "요청 분석",
    description: "요청을 분석합니다.",
    status: "completed",
    elapsed_ms: 10,
  });
  const result = JSON.stringify({
    type: "result",
    request_id: "request-2",
    sequence: 2,
    data: { invalid: true },
  });
  const upstream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${progress}\n${result}\n`));
    },
  });

  const events = await withTimeout(
    readNdjson(
      createTargetingProxyStream(upstream, () => {
        throw new Error("mapping failed");
      }),
    ),
  );

  assert.deepEqual(events.map((event) => event.type), ["progress", "error"]);
  assert.equal(events[1]?.sequence, 2);
});


function upstreamOf(lines: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${lines.join("\n")}\n`));
      controller.close();
    },
  });
}

test("the proxy forwards an accounting event and the terminal after it", async () => {
  // 회계가 terminal 앞에 오므로, 프록시가 그것을 못 흘리면 순번이 어긋나 결과가 사라진다.
  const upstream = upstreamOf([
    JSON.stringify({
      type: "llm_accounting",
      request_id: "req-1",
      sequence: 1,
      calls: 1,
      measured_calls: 1,
      unmeasured_calls: 0,
      input_tokens: 10,
      output_tokens: 2,
      reasoning_tokens: null,
      cache: {
        reported_calls: 1,
        input_tokens: 10,
        cached_input_tokens: 4,
        uncached_input_tokens: 6,
        hit_ratio: 0.4,
      },
      cost: {
        status: "priced",
        priced_calls: 1,
        unpriced_models: [],
        rejected_declarations: [],
        complete: true,
        usd: 0.001,
        without_cache_usd: 0.002,
        saved_usd: 0.001,
        saved_ratio: 0.5,
      },
      by_model: [],
    }),
    JSON.stringify({
      type: "result",
      request_id: "req-1",
      sequence: 2,
      data: { status: "success" },
    }),
  ]);
  const events = await withTimeout(
    readNdjson(createTargetingProxyStream(upstream, (data) => data)),
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["llm_accounting", "result"],
  );
});

test("an event type the proxy has never seen does not become a 502", async () => {
  const upstream = upstreamOf([
    JSON.stringify({ type: "brand_new", request_id: "req-1", sequence: 1 }),
    JSON.stringify({
      type: "result",
      request_id: "req-1",
      sequence: 2,
      data: { status: "success" },
    }),
  ]);
  const events = await withTimeout(
    readNdjson(createTargetingProxyStream(upstream, (data) => data)),
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["brand_new", "result"],
  );
});
