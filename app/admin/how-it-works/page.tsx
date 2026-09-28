import Link from "next/link";
import { ArrowLeft, Workflow } from "lucide-react";

import { HowItWorks } from "@/components/how-it-works";

export const metadata = {
  title: "어떻게 동작하나",
  description:
    "자연어 요청이 검증된 타겟 SQL이 되기까지의 단계와, 모델이 정하는 것과 프로그램이 정하는 것의 경계",
};

export default function HowItWorksAdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Workflow className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-xl font-bold text-foreground">
              어떻게 동작하나
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              앱으로
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          한 줄로 말하면 이렇습니다 — 모델은 <strong className="font-semibold text-foreground">무엇을
          의미했는지</strong>만 제안하고, 실제 표 · 컬럼 · SQL 은 프로그램이 카탈로그 선언으로
          정합니다. 의미를 증명하지 못하면 비슷하게 맞는 SQL 을 만들지 않고 멈춥니다. 아래 그림은
          의미 해석을 llm_primary 모드로만 도는 배포를 그린 것입니다.
        </p>
      </header>

      <HowItWorks />
    </main>
  );
}
