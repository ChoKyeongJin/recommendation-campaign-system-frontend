"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";
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

  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" role="status" aria-live="polite">
      <Gauge size={17} aria-hidden className="text-muted-foreground" />
      {snapshot ? <>
        <strong className={snapshot.remaining === 0 ? "text-destructive" : "text-foreground"}>오늘 {snapshot.remaining.toLocaleString()}회 남음</strong>
        <span className="text-muted-foreground">{snapshot.used.toLocaleString()} / {snapshot.daily_limit.toLocaleString()}회 사용 · 전체 사용자 합산 · 한국시간 자정 초기화</span>
      </> : <span className="text-muted-foreground">{failed ? "남은 호출 횟수를 확인할 수 없습니다." : "남은 호출 횟수 확인 중…"}</span>}
    </div>
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setRefresh((value) => value + 1)} aria-label="남은 호출 횟수 새로고침" className="rounded p-1 text-muted-foreground hover:bg-muted"><RefreshCw size={15} aria-hidden /></button>
      <Link href="/admin/setup" className="font-medium text-primary hover:underline">한도 설정</Link>
    </div>
  </div>;
}
