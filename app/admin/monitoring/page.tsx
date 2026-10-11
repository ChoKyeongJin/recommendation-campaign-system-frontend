import { AdminPage } from "@/components/admin-page";
import { QueryMonitoring } from "@/components/query-monitoring";

export const metadata = { title: "모니터링 | TARGET LAB", description: "실패한 자연어 요청의 호출 시각과 실패 원인을 확인합니다." };

export default function Page() {
  return <AdminPage kind="monitoring" title="요청 모니터링" description="어떤 요청이, 언제, 왜 실패했는지 확인하세요.">
    <QueryMonitoring />
  </AdminPage>;
}
