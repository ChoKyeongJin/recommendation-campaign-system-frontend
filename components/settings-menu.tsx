"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Blocks, ChevronDown, Settings, Workflow, Wrench } from "lucide-react";

// 메뉴에 세우는 것만 적는다. `/admin/prompts` 와 `/admin/reference` 는 화면도 API 도 그대로
// 살아 있고 주소로 열리지만, 일상적으로 쓰는 자리가 아니라 목록에서 내렸다.
const SETTINGS_LINKS = [
  { href: "/admin/how-it-works", label: "어떻게 동작하나", icon: Workflow },
  { href: "/admin/building-blocks", label: "조건은 어떻게 조립되나", icon: Blocks },
  { href: "/admin/setup", label: "처음 세팅하는 법", icon: Wrench },
] as const;

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Settings className="h-4 w-4" aria-hidden />
        설정
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 flex w-max min-w-52 flex-col rounded-lg border border-border bg-card p-1 shadow-lg ring-1 ring-foreground/5"
        >
          {SETTINGS_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
