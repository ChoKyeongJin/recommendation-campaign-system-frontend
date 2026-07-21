import { NextResponse } from "next/server";

import { type Channel } from "@/lib/campaign-data";
import { normalizeTargetingTrace, parsePythonResponse } from "@/lib/targeting-trace";

const PYTHON_TARGET_SQL_URL =
  process.env.PYTHON_TARGET_SQL_URL ?? "http://127.0.0.1:8000/target-sql";
const PYTHON_TARGET_SQL_TRACE_URL =
  process.env.PYTHON_TARGET_SQL_TRACE_URL ?? `${PYTHON_TARGET_SQL_URL}/trace`;

const channelDescriptions: Record<Channel, string> = {
  LMS: "장문 문자 메시지, 텍스트 중심",
  RCS: "리치 메시지, 버튼 및 이미지 지원",
};

function isChannel(value: unknown): value is Channel {
  return value === "LMS" || value === "RCS";
}

function getPromptForPython(prompt: string, channel: Channel) {
  return `${prompt.trim()}\n발송 채널: ${channel} (${channelDescriptions[channel]})`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const prompt =
    body && typeof body.prompt === "string" ? body.prompt.trim() : "";
  const channel = body && isChannel(body.channel) ? body.channel : null;

  if (!prompt || !channel) {
    return NextResponse.json(
      { error: "prompt와 channel이 필요합니다." },
      { status: 400 },
    );
  }

  const pythonPrompt = getPromptForPython(prompt, channel);

  try {
    const pythonResponse = await fetch(PYTHON_TARGET_SQL_TRACE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: pythonPrompt, execute: true }),
      cache: "no-store",
    });

    const rawText = await pythonResponse.text();
    const data = parsePythonResponse(rawText);

    if (!pythonResponse.ok) {
      return NextResponse.json(
        {
          error: "Python 추론 트레이스 API 호출에 실패했습니다.",
          detail: data ?? rawText,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(normalizeTargetingTrace(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: "Python 추론 트레이스 API를 호출할 수 없습니다.", detail: message },
      { status: 502 },
    );
  }
}
