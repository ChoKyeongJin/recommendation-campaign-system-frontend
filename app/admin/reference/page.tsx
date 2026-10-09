import { AdminPage } from "@/components/admin-page";
import { ReferenceViewer } from "@/components/reference-viewer";

export const metadata = { title: "참조 데이터 | TARGET LAB", description: "현재 배포가 읽는 설정과 참조 파일을 확인하세요. 설정 변경은 배포 설정에서 진행할 수 있습니다." };

export default function Page() {
  return <AdminPage kind="reference" title="참조 데이터" description="현재 배포가 읽는 설정과 참조 파일을 확인하세요. 설정 변경은 배포 설정에서 진행할 수 있습니다.">
    <div className="admin-content-card"><ReferenceViewer /></div>
  </AdminPage>;
}
