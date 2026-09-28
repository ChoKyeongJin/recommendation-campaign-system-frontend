import Link from "next/link";
import { ArrowLeft, Workflow } from "lucide-react";

import { HowItWorks } from "@/components/how-it-works";

export const metadata = {
  title: "어떻게 동작하나",
  description: "요청 한 줄이 고객 명단이 되기까지의 여섯 단계를 예시로 따라가며 설명합니다",
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
          요청 한 줄이 고객 명단이 되기까지 여섯 단계를 지납니다. AI 는{" "}
          <strong className="font-semibold text-foreground">무슨 말인지 알아듣는 일</strong>만
          맡고, 실제로 어느 데이터를 어떻게 꺼낼지는 프로그램이 미리 정해 둔 규칙대로 합니다.
          확실하지 않으면 대충 비슷한 명단을 만들지 않고 멈춥니다.
        </p>
      </header>

      <HowItWorks />
    </main>
  );
}
