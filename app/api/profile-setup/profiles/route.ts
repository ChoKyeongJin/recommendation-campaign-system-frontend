import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";
import { settingsRequestIsSameOrigin } from "@/lib/settings-auth";
import { pythonFetch } from "@/lib/python-api";

export async function POST(request: Request) {
  if (!settingsRequestIsSameOrigin(request)) {
    return NextResponse.json({ detail: "설정 화면에서 프로필을 만드세요." }, { status: 403 });
  }
  try {
    const body = await request.text();
    if (body.length > 64_000) return NextResponse.json({ detail: "입력이 너무 큽니다." }, { status: 413 });
    return proxyPromptResponse(await pythonFetch(promptApiUrl("/profile-setup/profiles"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
  } catch {
    return NextResponse.json({ detail: "프로필 생성 결과를 확인하지 못했습니다. 화면을 새로 불러와 주세요." }, { status: 502 });
  }
}
