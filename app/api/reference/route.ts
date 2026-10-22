import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";
import { pythonFetch } from "@/lib/python-api";

// GET /api/reference → 참조 파일(docs/data · docs/prompts) 목록 조회. 읽기 전용.
export async function GET() {
  try {
    const response = await pythonFetch(promptApiUrl("/reference-files"), {
      cache: "no-store",
    });
    return proxyPromptResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { detail: `reference_api_unreachable:${message}` },
      { status: 502 },
    );
  }
}
