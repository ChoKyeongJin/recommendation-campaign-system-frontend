import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";
import { settingsRequestIsSameOrigin } from "@/lib/settings-auth";

export async function POST(request: Request) {
  if (!settingsRequestIsSameOrigin(request)) {
    return NextResponse.json({ detail: "설정 화면에서 DB를 선택하세요." }, { status: 403 });
  }
  try {
    const body = await request.text();
    if (body.length > 1000) return NextResponse.json({ detail: "입력이 너무 큽니다." }, { status: 413 });
    return proxyPromptResponse(await fetch(promptApiUrl("/profile-setup/database"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
  } catch {
    return NextResponse.json({ detail: "DB 선택 결과를 확인하지 못했습니다. 화면을 새로 불러와 주세요." }, { status: 502 });
  }
}
