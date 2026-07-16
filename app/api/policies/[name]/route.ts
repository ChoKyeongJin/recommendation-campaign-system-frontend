import { NextResponse } from "next/server";

import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

type Params = { params: Promise<{ name: string }> };

function targetUrl(name: string) {
  return promptApiUrl(`/policies/${encodeURIComponent(name)}`);
}

function unreachable(error: unknown) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  return NextResponse.json(
    { detail: `policy_api_unreachable:${message}` },
    { status: 502 },
  );
}

// GET /api/policies/{name} → 단일 정책 조회
export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  try {
    const response = await fetch(targetUrl(name), { cache: "no-store" });
    return proxyPromptResponse(response);
  } catch (error) {
    return unreachable(error);
  }
}

// PUT /api/policies/{name} → 정책 추가/수정(upsert)
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

// DELETE /api/policies/{name} → 정책 삭제
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
