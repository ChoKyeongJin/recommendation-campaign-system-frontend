import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

// POST /api/policies/seed → docs/policies 파일 내용으로 DB 시딩
export async function POST() {
  try {
    const response = await fetch(promptApiUrl("/policies/seed"), {
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
