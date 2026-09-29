import { NextResponse } from "next/server";

/**
 * 이 배포가 요청마다 고르게 해 둔 구조화 모델.
 *
 * 목록은 Python 이 소유한다(배포 선언 `OPENAI_STRUCTURING_MODEL_CHOICES`). 여기서 기본값을
 * 적어 두면 배포를 바꾼 날 화면만 옛 목록을 들고 있게 된다. Python 에 못 닿으면 **빈 목록**을
 * 돌려준다 — 화면은 그때 고르는 칸을 감추고, 요청은 배포 기본값으로 그냥 나간다.
 */

const PYTHON_STRUCTURING_MODELS_URL =
  process.env.PYTHON_STRUCTURING_MODELS_URL ??
  "http://127.0.0.1:8000/structuring-models";

export async function GET() {
  try {
    const response = await fetch(PYTHON_STRUCTURING_MODELS_URL, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ choices: [], default: null });
    }
    const body = await response.json();
    const choices = Array.isArray(body?.choices)
      ? body.choices.filter((item: unknown): item is string => typeof item === "string")
      : [];
    const fallback =
      typeof body?.default === "string" && body.default ? body.default : null;
    return NextResponse.json({ choices, default: fallback });
  } catch {
    return NextResponse.json({ choices: [], default: null });
  }
}
