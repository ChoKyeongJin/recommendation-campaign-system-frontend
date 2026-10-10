import { BookOpen, ChevronDown } from "lucide-react";
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
    </AdminPage>
  );
}
