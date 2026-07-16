const PROMPT_API_BASE =
  process.env.PYTHON_PROMPT_API_BASE ?? "http://127.0.0.1:8000";

export function promptApiUrl(path: string) {
  return `${PROMPT_API_BASE.replace(/\/$/, "")}${path}`;
}

/**
 * 백엔드(FastAPI) 응답을 그대로 프론트로 전달한다.
 * 성공/실패 상태 코드와 JSON 바디를 보존해 화면에서 규약대로 처리할 수 있게 한다.
 */
export async function proxyPromptResponse(response: Response) {
  const { NextResponse } = await import("next/server");
  const rawText = await response.text();

  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { detail: rawText };
    }
  }

  return NextResponse.json(data ?? {}, { status: response.status });
}
