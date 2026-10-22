import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";
import { settingsRequestIsSameOrigin } from "@/lib/settings-auth";
import { pythonFetch } from "@/lib/python-api";

export async function GET() {
  try {
    return proxyPromptResponse(await pythonFetch(promptApiUrl("/profile-setup"), { cache: "no-store" }));
  } catch {
    return NextResponse.json({ detail: "설정 서버에 연결하지 못했습니다." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  if (!settingsRequestIsSameOrigin(request)) {
    return NextResponse.json({ detail: "설정 화면에서 저장하세요." }, { status: 403 });
  }
  try {
    const body = await request.text();
    if (body.length > 1_000_000) return NextResponse.json({ detail: "입력이 너무 큽니다." }, { status: 413 });
    return proxyPromptResponse(await pythonFetch(promptApiUrl("/profile-setup"), {
      method: "PUT", headers: { "Content-Type": "application/json" }, body,
    }));
  } catch {
    return NextResponse.json({ detail: "저장 결과를 확인하지 못했습니다. 설정을 새로 불러와 확인하세요." }, { status: 502 });
  }
}
