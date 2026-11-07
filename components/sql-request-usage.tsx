"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Gauge, RefreshCw } from "lucide-react";
import type { SqlRequestLimit } from "@/lib/sql-request-limit";

export function SqlRequestUsage({ refreshKey }: { refreshKey: number }) {
  const [snapshot, setSnapshot] = useState<SqlRequestLimit | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/request-limits", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("quota unavailable");
        const data: SqlRequestLimit = await response.json();
        if (!cancelled) { setSnapshot(data); setFailed(false); }
      } catch {
        if (!cancelled) { setSnapshot(null); setFailed(true); }
      } finally { pending = false; }
    }
    void load();
    const timer = setInterval(() => void load(), 30_000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshKey, refresh]);

  return <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border bg-card py-1.5 pl-4 pr-2 text-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5" role="status" aria-live="polite">
      <Gauge size={17} aria-hidden className="text-muted-foreground" />
      {snapshot ? <>
        <strong className={`font-semibold ${snapshot.remaining === 0 ? "text-destructive" : "text-foreground"}`}>오늘 <span className="font-display text-2xl font-normal leading-none tracking-normal">{snapshot.remaining.toLocaleString()}</span>회 남음</strong>
        <span className="text-[13px] text-muted-foreground">{snapshot.used.toLocaleString()} / {snapshot.daily_limit.toLocaleString()}회 사용 · 전체 사용자 합산 · 한국시간 자정 초기화</span>
      </> : <span className="text-muted-foreground">{failed ? "남은 호출 횟수를 확인할 수 없습니다." : "남은 호출 횟수 확인 중…"}</span>}
    </div>
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => setRefresh((value) => value + 1)} aria-label="남은 호출 횟수 새로고침" className="grid size-11 place-items-center rounded text-muted-foreground hover:bg-muted"><RefreshCw size={15} aria-hidden /></button>
      <Link href="/admin/setup" className="inline-flex min-h-11 items-center gap-1.5 px-2 font-semibold text-brand hover:underline">한도 설정<ArrowRight size={15} aria-hidden /></Link>
    </div>
  </div>;
}
