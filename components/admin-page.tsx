import Link from "next/link";
import { ArrowUpRight, Blocks, BookOpen, Database, Settings2, SlidersHorizontal, Workflow } from "lucide-react";

const settingsPages = [
  { href: "/admin/setup", label: "배포 설정", icon: Settings2 },
  { href: "/admin/prompts", label: "프롬프트 관리", icon: SlidersHorizontal },
  { href: "/admin/reference", label: "참조 데이터", icon: Database },
];

export function AdminPage({ title, description, kind, children }: {
  title: string;
  description: string;
  kind: "setup" | "prompts" | "reference" | "how-it-works" | "building-blocks";
  children: React.ReactNode;
}) {
  const isSettings = ["setup", "prompts", "reference"].includes(kind);
  const Icon = isSettings ? Settings2 : kind === "how-it-works" ? Workflow : Blocks;
  return (
    <main className={`admin-workspace admin-${kind}`}>
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow"><span />{isSettings ? "WORKSPACE SETTINGS" : "TARGET LAB GUIDE"}</p>
          <h1>{title}</h1>
          <p className="admin-page-description">{description}</p>
        </div>
        <span className="admin-page-emblem"><Icon size={28} strokeWidth={1.6} aria-hidden /></span>
      </header>
      {isSettings ? (
        <nav className="admin-section-nav" aria-label="설정 메뉴">
          {settingsPages.map(({ href, label, icon: ItemIcon }) => (
            <Link key={href} href={href} aria-current={href === `/admin/${kind}` ? "page" : undefined}>
              <ItemIcon size={17} aria-hidden />{label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="admin-guide-banner"><BookOpen size={20} aria-hidden /><p>예시를 따라가며 타겟이 만들어지는 과정을 살펴보세요.</p>
          <Link href={kind === "how-it-works" ? "/admin/building-blocks" : "/admin/how-it-works"}>
            {kind === "how-it-works" ? "조건 구성 살펴보기" : "전체 흐름 살펴보기"}<ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>
      )}
      {children}
    </main>
  );
}
