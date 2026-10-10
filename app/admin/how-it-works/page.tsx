import { AdminPage } from "@/components/admin-page";
import { HowItWorks } from "@/components/how-it-works";

const description = "벡터·단어 검색과 ID·이름 확인으로 후보를 찾고, AI의 의미 해석을 검증해 고객을 조회합니다. 일곱 단계의 흐름을 직접 확인해 보세요.";

export const metadata = { title: "한 문장에서 타겟이 되기까지 | TARGET LAB", description };

export default function Page() {
  return <AdminPage kind="how-it-works" title="한 문장에서 타겟이 되기까지" description={description}>
    <HowItWorks />
  </AdminPage>;
}
