import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

type Params = { params: Promise<{ name: string }> };

function targetUrl(name: string) {
  // name에는 파일 확장자(.txt)가 포함되므로 반드시 인코딩한다.
  return promptApiUrl(`/prompts/${encodeURIComponent(name)}`);
}

function unreachable(error: unknown) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  return NextResponse.json(
    { detail: `prompt_api_unreachable:${message}` },
    { status: 502 },
  );
}

// GET /api/prompts/{name} → 단일 프롬프트 조회
export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  try {
    const response = await fetch(targetUrl(name), { cache: "no-store" });
    return proxyPromptResponse(response);
  } catch (error) {
    return unreachable(error);
  }
}

// PUT /api/prompts/{name} → 프롬프트 추가/수정(upsert)
export async function PUT(request: Request, { params }: Params) {
  const { name } = await params;
  const body = await request.json().catch(() => null);

  try {
    const response = await fetch(targetUrl(name), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    return proxyPromptResponse(response);
  } catch (error) {
    return unreachable(error);
  }
}

// DELETE /api/prompts/{name} → 프롬프트 삭제
export async function DELETE(_request: Request, { params }: Params) {
  const { name } = await params;
  try {
    const response = await fetch(targetUrl(name), {
      method: "DELETE",
      cache: "no-store",
    });
    return proxyPromptResponse(response);
  } catch (error) {
    return unreachable(error);
  }
}
