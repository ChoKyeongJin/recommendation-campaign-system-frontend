import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";

export async function GET() {
  try {
    const response = await proxyPromptResponse(await fetch(promptApiUrl("/request-limits"), { cache: "no-store" }));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ detail: "호출 한도를 불러오지 못했습니다." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
      (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)) {
    return NextResponse.json({ detail: "설정 화면에서 저장하세요." }, { status: 403 });
  }
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ detail: "입력이 너무 큽니다." }, { status: 413 });
    return proxyPromptResponse(await fetch(promptApiUrl("/request-limits"), {
      method: "PUT", headers: { "Content-Type": "application/json" }, body, cache: "no-store",
    }));
  } catch {
    return NextResponse.json({ detail: "저장 결과를 확인하지 못했습니다. 한도를 새로 불러와 확인하세요." }, { status: 502 });
  }
}
