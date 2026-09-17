import { NextResponse } from "next/server";

import { normalizeTargetingTrace, parsePythonResponse } from "@/lib/targeting-trace";

const PYTHON_TARGET_SQL_URL =
  process.env.PYTHON_TARGET_SQL_URL ?? "http://127.0.0.1:8000/target-sql";
const PYTHON_TARGET_SQL_TRACE_URL =
  process.env.PYTHON_TARGET_SQL_TRACE_URL ?? `${PYTHON_TARGET_SQL_URL}/trace`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const prompt =
    body && typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "prompt가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const pythonResponse = await fetch(PYTHON_TARGET_SQL_TRACE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, execute: true }),
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
