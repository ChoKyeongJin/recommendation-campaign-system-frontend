import Link from "next/link";
import { ArrowLeft, Gauge } from "lucide-react";

import { HeuristicCtrManager } from "@/components/heuristic-ctr-manager";

export const metadata = {
  title: "휴리스틱 CTR 룰",
  description:
    "휴리스틱 CTR 스코어러가 변형별 예측 CTR을 계산할 때 쓰는 값을 관리하는 화면",
};

export default function HeuristicCtrRulesAdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gauge className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-xl font-bold text-foreground">
              휴리스틱 CTR 룰
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
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            heuristic-ctr-rules
          </code>{" "}
          정책을 DB에서 관리합니다. 저장은 DB에 기록하고, 적용은 실행 중인 서버에
          반영합니다.
        </p>
      </header>

      <HeuristicCtrManager />
    </main>
  );
}
