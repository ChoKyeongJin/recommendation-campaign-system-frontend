"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Clock3, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import {
  emptyFilters, failureQuery, failureReadError, failureStages, failureSummary, failureTime, parseFailurePage,
  type FailureFilters, type FailurePage, type FailureRecord,
} from "@/lib/query-monitoring";

const inputClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40";

function FailureRow({ item }: { item: FailureRecord }) {
  return <details className="group border-t border-border first:border-t-0 open:bg-muted/30">
    <summary className="grid cursor-pointer list-none grid-cols-1 gap-3 p-5 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[180px_minmax(0,1.15fr)_minmax(0,1fr)_24px] lg:gap-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:block">
        <span className="font-medium text-foreground">{item.called_at ? "호출 시각" : "실패 기록 시각"}</span>
        <time dateTime={item.called_at ?? item.recorded_at} className="tabular-nums lg:mt-1.5 lg:block">{failureTime(item.called_at ?? item.recorded_at)}</time>
      </div>
      <p className="line-clamp-2 min-w-0 whitespace-pre-wrap break-words text-sm font-semibold leading-6">{item.prompt || "자연어 내용 없음"}</p>
      <div className="min-w-0">
        <span className="mb-1.5 inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{failureStages[item.failure_stage] ?? item.failure_stage}</span>
        <p className="line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{failureSummary(item)}</p>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground lg:self-center"><span className="lg:sr-only">상세 보기</span><ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden /></span>
    </summary>
    <div className="mx-5 mb-5 space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div><h3 className="mb-2 text-xs font-semibold text-muted-foreground">요청한 자연어</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.prompt || "자연어 내용 없음"}</p></div>
      <div><h3 className="mb-2 text-xs font-semibold text-muted-foreground">실패 원인</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{failureSummary(item)}</p>
        {item.message && item.message !== failureSummary(item) && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{item.message}</p>}
      </div>
      <dl className="grid min-w-0 grid-cols-1 gap-4 border-t border-border pt-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
        <div><dt className="text-muted-foreground">호출 시각 (한국시간)</dt><dd className="mt-1.5">{item.called_at ? failureTime(item.called_at) : "과거 기록에는 호출 시각이 저장되지 않았습니다."}</dd></div>
        <div><dt className="text-muted-foreground">실패 기록 시각 (한국시간)</dt><dd className="mt-1.5">{failureTime(item.recorded_at)}</dd></div>
        <div><dt className="text-muted-foreground">실패 코드</dt><dd className="mt-1.5 break-all font-mono">{item.failure_reason}</dd></div>
        {item.diagnosis_stage && <div><dt className="text-muted-foreground">세부 실패 단계</dt><dd className="mt-1.5">{item.diagnosis_stage}</dd></div>}
        {item.diagnosis_code && <div><dt className="text-muted-foreground">진단 코드</dt><dd className="mt-1.5 break-all font-mono">{item.diagnosis_code}</dd></div>}
        <div><dt className="text-muted-foreground">기록 번호 · 응답 상태</dt><dd className="mt-1.5 break-all">#{item.failure_log_id} · {item.api_status ?? "기록 없음"}</dd></div>
      </dl>
    </div>
  </details>;
}

export function QueryMonitoring() {
  const [draft, setDraft] = useState<FailureFilters>(emptyFilters);
  const [filters, setFilters] = useState<FailureFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<FailurePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    async function load() {
      try {
        const response = await fetch(`/api/monitoring/failures?${failureQuery(filters, page)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(failureReadError(body));
        const result = parseFailurePage(body);
        if (!result) throw new Error("실패 기록 응답을 확인할 수 없습니다. 다시 시도해 주세요.");
        if (!controller.signal.aborted) {
          setData(result);
          setUpdatedAt(new Date().toISOString());
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "실패 기록을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, page, refresh]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.since && draft.until && draft.since > draft.until) {
      setFormError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    setFormError("");
    setFilters({ ...draft });
    setPage(1);
  }

  function reset() {
    setDraft({ ...emptyFilters });
    setFilters({ ...emptyFilters });
    setPage(1);
    setFormError("");
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const hasFilters = Object.values(filters).some((value) => value.trim());

  return <section className="space-y-5" aria-label="실패 요청 모니터링">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-3"><span className="rounded-lg bg-red-50 p-2.5 text-red-600"><AlertCircle size={21} aria-hidden /></span>
        <div><p className="text-sm font-semibold">실패한 자연어 요청</p><p className="mt-1 text-xs text-muted-foreground">저장된 실패 기록을 최신순으로 표시합니다.</p></div>
      </div>
      <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className={buttonClass}>
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />새로고침
      </button>
    </div>

    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-5" aria-label="실패 기록 검색">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_150px_auto]">
        <label className="space-y-2 text-xs font-medium"><span>자연어 · 실패 코드 검색</span><input className={inputClass} maxLength={200} placeholder="검색어를 입력하세요" value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} /></label>
        <label className="space-y-2 text-xs font-medium"><span>기록 시작일</span><input type="date" className={inputClass} value={draft.since} onChange={(event) => setDraft({ ...draft, since: event.target.value })} /></label>
        <label className="space-y-2 text-xs font-medium"><span>기록 종료일</span><input type="date" className={inputClass} value={draft.until} onChange={(event) => setDraft({ ...draft, until: event.target.value })} /></label>
        <label className="space-y-2 text-xs font-medium"><span>실패 단계</span><select className={inputClass} value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })}>
          <option value="">전체 단계</option>{Object.entries(failureStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <div className="flex gap-2"><button className={`${buttonClass} !border-primary !bg-primary !text-primary-foreground`} type="submit"><Search size={15} aria-hidden />검색</button><button className={buttonClass} type="button" onClick={reset}>초기화</button></div>
      </div>
      {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
      <p className="text-xs leading-5 text-muted-foreground">기간은 실패 기록일 기준이며, 모든 시각은 한국시간(KST)입니다.</p>
    </form>

    <div className="overflow-hidden rounded-xl border border-border bg-card" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">실패 기록 {data && <span className="ml-1 text-muted-foreground">{data.total.toLocaleString("ko-KR")}건</span>}</h2>
        {updatedAt && !error && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 size={13} aria-hidden />최근 조회 {failureTime(updatedAt)}</p>}
      </div>
      {loading ? <div role="status" className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin" aria-hidden />실패 기록을 불러오는 중입니다.</div>
        : error ? <div role="alert" className="space-y-4 p-8 text-center"><AlertCircle className="mx-auto text-destructive" size={28} aria-hidden /><p className="text-sm">{error}</p><button type="button" className={buttonClass} onClick={() => setRefresh((value) => value + 1)}>다시 시도</button></div>
          : data?.items.length ? <>
            <div className="hidden grid-cols-[180px_minmax(0,1.15fr)_minmax(0,1fr)_24px] gap-6 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground lg:grid" aria-hidden><span>시각</span><span>요청한 자연어</span><span>실패 단계 · 원인</span><span /></div>
            <div>{data.items.map((item) => <FailureRow key={item.failure_log_id} item={item} />)}</div>
          </> : <div role="status" className="space-y-2 p-12 text-center"><Inbox size={30} className="mx-auto mb-3 text-muted-foreground" aria-hidden /><p className="text-sm font-medium">{hasFilters ? "검색 조건에 맞는 실패 기록이 없습니다." : "저장된 실패 기록이 없습니다."}</p><p className="text-xs text-muted-foreground">{hasFilters ? "기간이나 검색어를 바꿔 확인해 보세요." : "실패한 요청이 기록되면 이곳에서 확인할 수 있습니다."}</p></div>}
      {data && data.total > 0 && <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4" aria-label="실패 기록 페이지">
        <p className="text-xs text-muted-foreground">{page} / {pages} 페이지 · 페이지당 20건</p>
        <div className="flex gap-2"><button className={buttonClass} type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} aria-hidden />이전</button>
          <button className={buttonClass} type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>다음<ChevronRight size={15} aria-hidden /></button></div>
      </nav>}
    </div>
  </section>;
}
