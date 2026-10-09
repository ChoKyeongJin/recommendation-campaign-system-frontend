import { AdminPage } from "@/components/admin-page";
import { HowItWorks } from "@/components/how-it-works";

export const metadata = { title: "한 문장에서 타겟이 되기까지 | TARGET LAB", description: "AI가 요청의 뜻을 해석하고, 정해진 규칙으로 데이터를 조회합니다. 여섯 단계의 흐름을 직접 확인해 보세요." };

export default function Page() {
  return <AdminPage kind="how-it-works" title="한 문장에서 타겟이 되기까지" description="AI가 요청의 뜻을 해석하고, 정해진 규칙으로 데이터를 조회합니다. 여섯 단계의 흐름을 직접 확인해 보세요.">
    <HowItWorks />
  </AdminPage>;
}
