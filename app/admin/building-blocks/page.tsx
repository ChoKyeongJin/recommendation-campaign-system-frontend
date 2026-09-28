import Link from "next/link";
import { ArrowLeft, Blocks } from "lucide-react";

import { BuildingBlocks } from "@/components/building-blocks";

export const metadata = {
  title: "조건은 어떻게 조립되나",
  description:
    "문장 하나가 정해진 블록 몇 개로 조립되어 조회문이 되기까지를, AI가 무엇을 고르고 무엇을 고르지 않는지와 함께 단계로 보여 줍니다",
};

export default function BuildingBlocksAdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Blocks className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-xl font-bold text-foreground">
              조건은 어떻게 조립되나
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
          「어떻게 동작하나」의 2~4단계 안쪽을 들여다보는 화면입니다. 이 시스템은{" "}
          <strong className="font-semibold text-foreground">
            문장 종류마다 기능을 새로 만들지 않습니다
          </strong>
          . 정해진 블록 몇 개를 레고처럼 새로 조립할 뿐입니다. 문장 하나가 실제로 어떻게
          조립되는지, 그중 무엇을 AI가 고르고{" "}
          <strong className="font-semibold text-foreground">
            무엇은 AI가 고를 수 없는지
          </strong>
          를 한 단계씩 따라가 보세요.
        </p>
      </header>

      <BuildingBlocks />
    </main>
  );
}
