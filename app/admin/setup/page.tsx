import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";

import { SetupGuide } from "@/components/setup-guide";

export const metadata = {
  title: "처음 세팅하는 법",
  description: "새 DB 를 이 시스템에 붙일 때의 순서와 사람이 채워야 하는 자리",
};

export default function SetupAdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-xl font-bold text-foreground">
              처음 세팅하는 법
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
          새 DB 를 붙이는 다섯 단계입니다. 1 · 3 · 5단계는 적어 둔 명령을 그대로
          실행하면 되고, 손으로 적는 곳은 4단계 하나입니다. 지금 배포가 어디까지
          채워졌는지는 이 화면이 아니라 db_swap_preflight.py 의 점검 결과와 막힌
          요청의 응답이 알려 줍니다.
        </p>
      </header>

      <SetupGuide />
    </main>
  );
}
