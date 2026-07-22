import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import { ReferenceViewer } from "@/components/reference-viewer";

export const metadata = {
  title: "참조 파일",
  description: "타겟팅 엔진이 읽는 데이터·프롬프트 파일을 읽기 전용으로 열람하는 화면",
};

export default function ReferenceAdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-xl font-bold text-foreground">참조 파일</h1>
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
          타겟팅 엔진이 실제로 읽는 데이터·사전·프롬프트 파일(docs/data, docs/prompts)을
          열람합니다. 각 파일의 용도 설명과 본문을 볼 수 있으며, 편집은 되지 않습니다(읽기 전용).
        </p>
      </header>

      <ReferenceViewer />
    </main>
  );
}
