import Link from "next/link";
import { Blocks, BookOpen, ChevronDown, Workflow } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { SetupGuide } from "@/components/setup-guide";
import { ProfileSetupEditor } from "@/components/profile-setup-editor";
import { SqlRequestLimitSettings } from "@/components/sql-request-limit-settings";

export const metadata = { title: "배포 설정 | TARGET LAB", description: "현재 배포의 필드, 값 목록, 지원 조건을 설정합니다." };

export default function SetupAdminPage() {
  return (
    <AdminPage kind="setup" title="타겟팅 환경 설정" description="고객 데이터와 조건을 연결하고, 우리 서비스에 맞는 타겟팅 환경을 만드세요.">
      <SqlRequestLimitSettings />
      <ProfileSetupEditor />
      <details className="admin-setup-guide">
        <summary><span className="admin-guide-icon"><BookOpen size={21} aria-hidden /></span>
          <span><strong>처음 설정하시나요?</strong><span>새 DB 연결과 초기 프로필 생성 안내를 확인하세요.</span></span>
          <ChevronDown size={19} className="guide-chevron" aria-hidden />
        </summary>
        <div className="admin-setup-guide-content"><SetupGuide /></div>
      </details>
      <nav className="-mt-3 flex w-full flex-nowrap items-center justify-end gap-4" aria-label="설정 도움말">
        <Link href="/admin/how-it-works" className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Workflow size={16} className="shrink-0" aria-hidden /><span>작동 방식</span>
        </Link>
        <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
        <Link href="/admin/building-blocks" className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Blocks size={16} className="shrink-0" aria-hidden /><span>조건 구성</span>
        </Link>
      </nav>
    </AdminPage>
  );
}
