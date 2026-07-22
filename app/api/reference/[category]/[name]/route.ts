import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

type Params = { params: Promise<{ category: string; name: string }> };

// GET /api/reference/{category}/{name} → 단일 참조 파일 본문 조회. 읽기 전용(GET 만 노출).
export async function GET(_request: Request, { params }: Params) {
  const { category, name } = await params;
  try {
    const response = await fetch(
      promptApiUrl(
        `/reference-files/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
      ),
      { cache: "no-store" },
    );
    return proxyPromptResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { detail: `reference_api_unreachable:${message}` },
      { status: 502 },
    );
  }
}
