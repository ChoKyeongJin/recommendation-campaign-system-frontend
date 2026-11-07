"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crosshair } from "lucide-react";
import { useState } from "react";
import { SettingsPasswordGate } from "@/components/settings-password-gate";

const navigation = [
  { href: "/", label: "타겟 만들기" },
  { href: "/admin/monitoring", label: "모니터링" },
  { href: "/admin/setup", label: "설정" },
];

const guidePages = [
  { href: "/admin/how-it-works", label: "작동 방식" },
  { href: "/admin/building-blocks", label: "조건 구성" },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [targetEntryKey, setTargetEntryKey] = useState(0);
  const [settingsEntryKey, setSettingsEntryKey] = useState(0);
  const title = navigation.find((item) => item.href === pathname)?.label
    ?? guidePages.find((item) => item.href === pathname)?.label
    ?? (pathname === "/admin/prompts" ? "프롬프트 관리" : "참조 데이터");
  const isSettingsPage = ["/admin/setup", "/admin/prompts", "/admin/reference"].includes(pathname);
  const isGuidePage = guidePages.some((item) => item.href === pathname);
  const isProtectedPage = isSettingsPage || pathname === "/admin/monitoring";
  const activeHref = isSettingsPage || isGuidePage ? "/admin/setup" : pathname;

  return (
    <div className="workspace-shell">
      <a href="#workspace-content" className="skip-link">본문으로 바로가기</a>
      {/* 모바일에서는 서랍 대신 화면 위쪽에 놓인다 — 메뉴가 셋뿐이라 한 줄에 다 들어간다. */}
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <Crosshair size={24} strokeWidth={1.6} aria-hidden />
          <span>TARGET LAB</span>
        </Link>
        <nav aria-label="주 메뉴" className="workspace-nav">
          {navigation.map(({ href, label }, index) => (
            <Link key={href} href={href}
              onNavigate={() => {
                if (href === "/") setTargetEntryKey((current) => current + 1);
                if (href === "/admin/setup" || href === "/admin/monitoring") setSettingsEntryKey((current) => current + 1);
              }}
              aria-current={activeHref === href ? "page" : undefined}
              className={`workspace-nav-link ${activeHref === href ? "is-active" : ""}`}>
              <span className="workspace-nav-index" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>조건부터 오디언스까지</p><span>더 쉬운 타겟팅의 시작</span>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="workspace-breadcrumb"><span>Workspace</span><span aria-hidden>/</span><strong>{title}</strong></div>
          <div className="workspace-identity"><span className="workspace-avatar" aria-hidden>T</span><span>내 워크스페이스</span></div>
        </header>
        {/* 같은 경로를 다시 눌러도 위저드를 새로 시작하고 기존 요청을 정리한다. */}
        <div key={pathname === "/" ? targetEntryKey : "other-page"} id="workspace-content" tabIndex={-1}>
          {isProtectedPage ? <SettingsPasswordGate key={settingsEntryKey} area={pathname === "/admin/monitoring" ? "모니터링" : "설정"}>{children}</SettingsPasswordGate> : children}
        </div>
      </div>
    </div>
  );
}
