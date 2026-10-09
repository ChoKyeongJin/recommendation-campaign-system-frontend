import { AdminPage } from "@/components/admin-page";
import { PromptManager } from "@/components/prompt-manager";

export const metadata = { title: "프롬프트 관리 | TARGET LAB", description: "고객의 요청을 해석하는 프롬프트를 관리하세요. 저장한 내용은 적용 후 타겟팅에 반영됩니다." };

export default function Page() {
  return <AdminPage kind="prompts" title="프롬프트 관리" description="고객의 요청을 해석하는 프롬프트를 관리하세요. 저장한 내용은 적용 후 타겟팅에 반영됩니다.">
    <div className="admin-content-card"><PromptManager /></div>
  </AdminPage>;
}
