import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

// GET /api/policies → 정책 목록 조회
export async function GET() {
  try {
    const response = await fetch(promptApiUrl("/policies"), {
      cache: "no-store",
    });
    return proxyPromptResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { detail: `policy_api_unreachable:${message}` },
      { status: 502 },
    );
  }
}
