"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, Crosshair, Menu, Settings, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SettingsPasswordGate } from "@/components/settings-password-gate";

const navigation = [
  { href: "/", label: "타겟 만들기", icon: SlidersHorizontal },
  { href: "/admin/monitoring", label: "모니터링", icon: Activity },
  { href: "/admin/setup", label: "설정", icon: Settings },
];

const guidePages = [
  { href: "/admin/how-it-works", label: "작동 방식" },
  { href: "/admin/building-blocks", label: "조건 구성" },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [targetEntryKey, setTargetEntryKey] = useState(0);
  const [settingsEntryKey, setSettingsEntryKey] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
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
      {mobileOpen && <button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)} />}
      <aside id="workspace-navigation" className={`workspace-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link href="/" className="workspace-brand" onClick={() => setMobileOpen(false)}>
          <Crosshair size={33} strokeWidth={1.8} aria-hidden />
          <span>TARGET LAB</span>
        </Link>
        <nav aria-label="주 메뉴" className="workspace-nav">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              onNavigate={() => {
                if (href === "/") setTargetEntryKey((current) => current + 1);
                if (href === "/admin/setup" || href === "/admin/monitoring") setSettingsEntryKey((current) => current + 1);
              }}
              aria-current={activeHref === href ? "page" : undefined}
              className={`workspace-nav-link ${activeHref === href ? "is-active" : ""}`}>
              <Icon size={23} strokeWidth={1.7} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-footer-icon"><BookOpen size={18} aria-hidden /></span>
          <div><p>조건부터 오디언스까지</p><span>더 쉬운 타겟팅의 시작</span></div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <button ref={menuButtonRef} type="button" className="mobile-menu-button" aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="workspace-breadcrumb"><span>워크스페이스</span><span aria-hidden>/</span><strong>{title}</strong></div>
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
