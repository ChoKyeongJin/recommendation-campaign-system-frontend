import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

export async function GET() {
  try {
    return proxyPromptResponse(await fetch(promptApiUrl("/profile-setup/apply"), { cache: "no-store" }));
  } catch {
    return NextResponse.json({ detail: "API가 재시작 중이거나 연결할 수 없습니다." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
      (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)) {
    return NextResponse.json({ detail: "설정 화면에서 적용하세요." }, { status: 403 });
  }
  try {
    const body = await request.text();
    if (body.length > 1000) return NextResponse.json({ detail: "입력이 너무 큽니다." }, { status: 413 });
    return proxyPromptResponse(await fetch(promptApiUrl("/profile-setup/apply"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
  } catch {
    return NextResponse.json({ detail: "적용 요청 결과를 확인하지 못했습니다. 화면을 새로 불러와 진행 상태를 확인하세요." }, { status: 502 });
  }
}
