import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";

import { SetupGuide } from "@/components/setup-guide";
import { ProfileSetupEditor } from "@/components/profile-setup-editor";

export const metadata = {
  title: "배포 설정",
  description: "현재 배포의 필드, 값 목록, 지원 조건을 한 화면에서 설정합니다.",
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
              배포 설정
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
          필드를 선택하고 이름과 값을 입력하세요. 현재 배포가 읽는 관련 설정에
          함께 반영되며, 저장 전에 누락과 충돌을 검사합니다.
        </p>
      </header>

      <ProfileSetupEditor />
      <details className="rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold">새 DB 연결과 초기 프로필 생성 안내</summary>
        <div className="mt-5"><SetupGuide /></div>
      </details>
    </main>
  );
}
