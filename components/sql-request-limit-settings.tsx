"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Gauge, RefreshCw, Save } from "lucide-react";
import { errorMessage } from "@/lib/profile-setup";
import type { SqlRequestLimit } from "@/lib/sql-request-limit";

export function SqlRequestLimitSettings() {
  const [snapshot, setSnapshot] = useState<SqlRequestLimit | null>(null);
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/request-limits", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data));
      setSnapshot(data); setLimit(String(data.daily_limit));
    } catch (error) {
      setError(error instanceof Error ? error.message : "호출 한도를 불러오지 못했습니다.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || busy) return;
    const dailyLimit = Number(limit);
    if (!/^\d+$/.test(limit) || !Number.isSafeInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1_000_000) {
      setError("하루 한도는 1~1,000,000 사이의 정수로 입력하세요."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/request-limits", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_limit: dailyLimit, revision: snapshot.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data));
      setSnapshot(data); setLimit(String(data.daily_limit));
      setMessage("하루 호출 한도를 저장했습니다. 지금부터 적용됩니다.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "호출 한도를 저장하지 못했습니다.");
    } finally { setBusy(false); }
  }

  const button = "settings-button inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";
  return <section className="mb-6 rounded-xl border border-border bg-card p-5" aria-labelledby="sql-request-limit-title" aria-busy={busy}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="sql-request-limit-title" className="flex items-center gap-2 text-base font-semibold"><Gauge size={19} aria-hidden />SQL 생성 호출 한도</h2>
        <p className="mt-2 text-sm text-muted-foreground">전체 사용자의 SQL 생성 요청을 합산합니다. 매일 한국시간 자정에 사용량이 초기화됩니다.</p>
      </div>
      <button className={button} type="button" disabled={busy} onClick={() => void load()}><RefreshCw size={15} aria-hidden />새로 불러오기</button>
    </div>
    {snapshot && <p className="mt-4 text-sm" role="status">오늘 <strong>{snapshot.used.toLocaleString()} / {snapshot.daily_limit.toLocaleString()}회</strong> 사용 · {snapshot.remaining.toLocaleString()}회 남음 <span className="text-muted-foreground">({snapshot.date}, 한국시간)</span></p>}
    <form onSubmit={(event) => void save(event)} className="mt-4 flex flex-wrap items-end gap-3">
      <label htmlFor="sql-daily-limit" className="flex flex-col gap-2 text-sm font-medium">하루 최대 호출 횟수
        <input id="sql-daily-limit" type="number" min={1} max={1_000_000} step={1} required value={limit} disabled={busy || !snapshot}
          onChange={(event) => setLimit(event.target.value)} aria-describedby="sql-daily-limit-hint"
          className="settings-input w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
      </label>
      <button className={button} type="submit" disabled={busy || !snapshot || limit === String(snapshot.daily_limit)}><Save size={15} aria-hidden />한도 저장</button>
    </form>
    <p id="sql-daily-limit-hint" className="mt-3 text-xs text-muted-foreground">기본 50회. 실패·취소된 생성 요청도 포함하며, 한도를 바꿔도 오늘 사용량은 유지됩니다. 저장 즉시 적용됩니다.</p>
    {busy && <p className="mt-3 text-sm text-muted-foreground" role="status">처리 중…</p>}
    {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    {message && <p className="mt-3 text-sm text-emerald-700" role="status">{message}</p>}
  </section>;
}
