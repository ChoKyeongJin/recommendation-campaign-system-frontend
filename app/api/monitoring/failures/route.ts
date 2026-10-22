import { NextResponse } from "next/server";
import { promptApiUrl, proxyPromptResponse } from "@/lib/prompt-api";
import { pythonFetch } from "@/lib/python-api";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.toString();
    const response = await proxyPromptResponse(await pythonFetch(promptApiUrl(`/monitoring/failures?${query}`), {
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    }));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  } catch {
    return NextResponse.json({ detail: "실패 기록 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
  }
}
