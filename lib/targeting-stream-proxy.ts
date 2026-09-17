import {
  NdjsonParser,
  TargetingStreamContract,
  type TargetingStreamEvent,
} from "./targeting-progress.ts";

type ResultMapper = (data: unknown) => unknown;

/**
 * Validate and forward the Python NDJSON stream.
 *
 * A terminal event is the end of the application-level stream. Forward it and
 * close immediately instead of waiting for the upstream HTTP connection to
 * reach EOF; some streaming servers keep that connection open after yielding
 * their final event.
 */
export function createTargetingProxyStream(
  upstreamBody: ReadableStream<Uint8Array>,
  mapResult: ResultMapper,
): ReadableStream<Uint8Array> {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const parser = new NdjsonParser();
  const contract = new TargetingStreamContract();
  let closed = false;
  let lastForwardedSequence = 0;

  const encodeEvent = (event: TargetingStreamEvent) =>
    encoder.encode(`${JSON.stringify(event)}\n`);

  const cancelUpstream = (reason?: unknown) => {
    void reader.cancel(reason).catch(() => undefined);
  };

  const closeWithContractError = (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ) => {
    if (closed) return;
    closed = true;
    controller.enqueue(
      encodeEvent({
        type: "error",
        request_id:
          contract.requestId ?? `targeting-proxy-${Date.now().toString(36)}`,
        // Mapping can fail after the upstream terminal event was accepted but
        // before it was forwarded. Continue from what the browser actually saw.
        sequence: lastForwardedSequence + 1,
        error: {
          status: 502,
          code: "upstream_stream_contract_invalid",
          message: "타겟 추출 진행 응답을 확인하지 못했습니다.",
        },
      }),
    );
    controller.close();
    cancelUpstream();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // A transport chunk need not contain a full NDJSON line. Keep reading
        // until something can be emitted so a partial chunk cannot stall the
        // downstream stream for lack of another pull.
        while (!closed) {
          const { done, value } = await reader.read();
          const events = parser.push(
            decoder.decode(value, { stream: !done }),
          );
          if (done) events.push(...parser.finish());

          for (const parsed of events) {
            const event = contract.accept(parsed);
            if (event === null) {
              closeWithContractError(controller);
              return;
            }

            const outgoingEvent: TargetingStreamEvent =
              event.type === "result"
                ? { ...event, data: mapResult(event.data) }
                : event;
            controller.enqueue(encodeEvent(outgoingEvent));
            lastForwardedSequence = outgoingEvent.sequence;

            if (event.type !== "progress") {
              closed = true;
              controller.close();
              cancelUpstream();
              return;
            }
          }

          if (done) {
            closeWithContractError(controller);
            return;
          }
          if (events.length > 0) return;
        }
      } catch {
        closeWithContractError(controller);
      }
    },
    cancel(reason) {
      closed = true;
      return reader.cancel(reason);
    },
  });
}
