import { AdminPage } from "@/components/admin-page";
import { BuildingBlocks } from "@/components/building-blocks";

export const metadata = { title: "고객 조건은 어떻게 만들어질까요? | TARGET LAB", description: "문장 속 의미가 조건 블록으로 연결되는 과정입니다. AI가 해석하는 부분과 정해진 규칙이 처리하는 부분을 살펴보세요." };

export default function Page() {
  return <AdminPage kind="building-blocks" title="고객 조건은 어떻게 만들어질까요?" description="문장 속 의미가 조건 블록으로 연결되는 과정입니다. AI가 해석하는 부분과 정해진 규칙이 처리하는 부분을 살펴보세요.">
    <BuildingBlocks />
  </AdminPage>;
}
