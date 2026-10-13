import { NextResponse } from "next/server";

import { promptApiUrl } from "@/lib/prompt-api";
import {
  MAX_TOPIC_LENGTH,
  readTopic,
  readTopicSuggestions,
  suggestionFailureMessage,
} from "@/lib/targeting-suggestion";

/**
 * 주제 → 타겟 조건 문장 초안.
 *
 * 문장은 Python 이 활성 카탈로그에서 근거를 확인해 만든다. 여기서는 주제를 넘기고 응답의
 * 모양만 확인한다 — 초안을 고치거나 보태면 근거와 문장이 어긋난다. SQL 생성 한도는 쓰지 않는다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const topic = readTopic(
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).topic
      : null,
  );
  if (!topic) {
    return NextResponse.json(
      { error: `주제를 ${MAX_TOPIC_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(promptApiUrl("/target-sql/prompt-suggestions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return NextResponse.json(
      { error: "문장 생성 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => null);
  const headers = { "Cache-Control": "no-store" };
  if (!upstream.ok) {
    return NextResponse.json(
      { error: suggestionFailureMessage(upstream.status, payload) },
      { status: upstream.status, headers },
    );
  }
  const result = readTopicSuggestions(payload);
  if (!result) {
    return NextResponse.json(
      { error: "문장 생성 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502, headers },
    );
  }
  return NextResponse.json(result, { headers });
}
