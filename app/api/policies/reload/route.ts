import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

// POST /api/policies/reload → 실행 중인 서버 캐시 리로드("변경사항 적용")
export async function POST() {
  try {
    const response = await fetch(promptApiUrl("/policies/reload"), {
      method: "POST",
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
