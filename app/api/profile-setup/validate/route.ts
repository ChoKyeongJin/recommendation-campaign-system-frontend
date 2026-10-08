import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ detail: "설정 화면에서 검사하세요." }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 1_000_000) return NextResponse.json({ detail: "입력이 너무 큽니다." }, { status: 413 });
    return proxyPromptResponse(await fetch(promptApiUrl("/profile-setup/validate"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
  } catch {
    return NextResponse.json({ detail: "설정 검사 서버에 연결하지 못했습니다." }, { status: 502 });
  }
}
