"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  METRIC_FUNCTIONS, TIE_POLICIES, measureFields, metricError, populationFields, populationValues, rankingPolicyChange,
  rankingPolicyError, repeatedEvents, type NewMetric, type RankingPolicyChange,
} from "@/lib/profile-declarations";
import type { SetupSnapshot } from "@/lib/profile-setup";

const input = "settings-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "settings-button rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
const functions = Object.fromEntries(METRIC_FUNCTIONS);
const fixedLabels: Record<string, [string, Record<string, string>]> = {
  null_policy: ["값이 없는 대상", { exclude: "순위에서 제외" }],
  missing_policy: ["기록이 없는 대상", { exclude: "순위에서 제외" }],
  small_population_policy: ["비율 컷의 인원 계산", { ceil: "올림" }],
};

const blank = (): NewMetric => ({ id: "", source: "", function: "count", measure_field: null, label: "", aliases: [], semantic_description: "", ranking: false });

export function ProfileSetupMetrics({ snapshot, metrics, onMetrics, ranking, onRanking }: {
  snapshot: SetupSnapshot; metrics: NewMetric[]; onMetrics: (metrics: NewMetric[]) => void;
  ranking: RankingPolicyChange | undefined; onRanking: (ranking: RankingPolicyChange | undefined) => void;
}) {
  const [draft, setDraft] = useState<NewMetric | null>(null);
  const [error, setError] = useState("");
  const subject = snapshot.subject.label || "고객";
  const sources = repeatedEvents(snapshot);
  const saved = Object.entries(snapshot.metrics ?? {});
  const policy = ranking ?? rankingPolicyChange(snapshot);
  const rankingAvailable = !!snapshot.ranking_policy || (!!ranking && !rankingPolicyError(ranking, snapshot));
  const policyProblem = ranking ? rankingPolicyError(ranking, snapshot) : "";
  const change = (patch: Partial<NewMetric>) => { if (draft) setDraft({ ...draft, ...patch }); setError(""); };
  const editPolicy = (patch: Partial<RankingPolicyChange>) => onRanking({ ...policy, ...patch });

  return <div className="space-y-6">
    <div className="settings-section-intro"><BarChart3 size={23} aria-hidden /><div><h2>지표와 순위</h2>
      <p>사건을 {subject}별로 세거나 더한 값(지표)을 만들면 “초과 근무 시간 100시간 이상”, “평가 점수 상위 10명” 같은 조건을 쓸 수 있습니다.</p></div></div>

    <section className="space-y-2" aria-label="등록된 지표">
      <h3 className="text-sm font-semibold">등록된 지표 {saved.length}개</h3>
      {saved.length === 0 && <p className="text-sm text-muted-foreground">아직 등록된 지표가 없습니다.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {saved.map(([id, metric]) => <div key={id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">{metric.label} <span className="text-xs font-normal text-muted-foreground">({id})</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{snapshot.events?.[metric.source]?.label ?? metric.source} · {functions[metric.function] ?? metric.function}{metric.measure_field ? ` · ${snapshot.fields[metric.measure_field]?.label ?? metric.measure_field}` : ""}{metric.unit ? ` · ${metric.unit}` : ""}{metric.ranking ? " · 순위 사용" : ""}</p>
        </div>)}
      </div>
    </section>

    {metrics.map((item) => <div key={item.id} className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-medium">{item.label} ({item.id}) · {functions[item.function]}</p>
      <p className="text-xs text-muted-foreground">저장 대기 중</p>
      <div className="flex gap-2"><button type="button" className={button} onClick={() => setDraft(item)}>수정</button>
        <button type="button" className={button} onClick={() => onMetrics(metrics.filter((other) => other !== item))}>추가 취소</button></div>
    </div>)}

    {!draft ? <button type="button" className={button} disabled={!sources.length} onClick={() => { setDraft(blank()); setError(""); }}>지표 추가</button>
      : <div className="space-y-4 rounded-xl border border-border p-4" aria-label="새 지표">
        <h3 className="font-semibold">새 지표</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">사건
            <select className={input} value={draft.source} onChange={(event) => change({ source: event.target.value, measure_field: null })}>
              <option value="">선택하세요</option>{sources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">계산
            <select className={input} value={draft.function} onChange={(event) => change({ function: event.target.value as NewMetric["function"], measure_field: null })}>
              {METRIC_FUNCTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </div>
        {draft.function !== "count" && <label className="flex flex-col gap-1.5 text-sm">측정할 값
          <select className={input} value={draft.measure_field ?? ""} onChange={(event) => change({ measure_field: event.target.value || null })}>
            <option value="">선택하세요</option>{measureFields(snapshot, draft.source).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">‘필드와 값’에서 단위까지 설정을 마친 숫자 필드만 보입니다.</span>
        </label>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">지표 이름<input className={input} value={draft.label} placeholder="예: 초과 근무 시간" onChange={(event) => change({ label: event.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-sm">지표 ID<input className={`${input} font-mono`} value={draft.id} placeholder="예: overtime_hours_total" onChange={(event) => change({ id: event.target.value.trim() })} /></label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">다른 이름(쉼표로 구분, 선택)
          <input className={input} value={draft.aliases.join(", ")} onChange={(event) => change({ aliases: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">지표의 뜻<input className={input} value={draft.semantic_description} placeholder={`예: ${subject}별 초과 근무 시간의 합.`} onChange={(event) => change({ semantic_description: event.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.ranking} onChange={(event) => change({ ranking: event.target.checked })} />순위(상위·하위 N명)에 이 지표를 씁니다</label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={`${button} bg-primary text-primary-foreground`} onClick={() => {
            const others = metrics.filter((item) => item !== draft && item.id !== draft.id);
            const problem = metricError(draft, snapshot, [...others, draft], rankingAvailable);
            if (problem) { setError(problem); return; }
            onMetrics([...others, draft]); setDraft(null);
          }}>변경 목록에 추가</button>
          <button type="button" className={button} onClick={() => { setDraft(null); setError(""); }}>닫기</button>
        </div>
      </div>}
    {!sources.length && <p className="text-xs text-muted-foreground">지표를 만들려면 {subject}마다 여러 번 일어나는 사건을 먼저 등록하고 저장하세요.</p>}

    <section className="space-y-4 rounded-xl border border-border p-4" aria-label="순위 정책">
      <div><h3 className="font-semibold">순위 정책</h3><p className="mt-1 text-xs text-muted-foreground">“상위 10명”, “하위 5%”를 어떤 {subject} 가운데서, 동점을 어떻게 처리해 고를지 정합니다. {snapshot.ranking_policy ? "" : "아직 설정되지 않아 순위 요청은 실행되지 않습니다."}</p></div>
      <label className="flex flex-col gap-1.5 text-sm">정책 이름<input className={input} value={policy.label} placeholder={`예: ${subject} 지표 순위`} onChange={(event) => editPolicy({ label: event.target.value })} /></label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">순위 대상 기준 필드
          <select className={input} value={policy.population_field} onChange={(event) => editPolicy({ population_field: event.target.value, population_value: "" })}>
            <option value="">선택하세요</option>{populationFields(snapshot).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">순위 대상 값
          <select className={input} value={policy.population_value} onChange={(event) => editPolicy({ population_value: event.target.value })}>
            <option value="">선택하세요</option>{populationValues(snapshot, policy.population_field).map((row) => <option key={row.canonical} value={row.canonical}>{row.label || row.canonical}</option>)}
          </select>
        </label>
      </div>
      <fieldset><legend className="mb-2 text-sm font-medium">자르는 단위</legend><div className="flex gap-4 text-sm">
        {(["count", "percent"] as const).map((unit) => <label key={unit} className="flex gap-2"><input type="checkbox" checked={policy.limit_units.includes(unit)}
          onChange={(event) => editPolicy({ limit_units: event.target.checked ? [...policy.limit_units, unit] : policy.limit_units.filter((item) => item !== unit) })} />{unit === "count" ? "명(상위 N명)" : "비율(상위 N%)"}</label>)}
      </div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">동점 처리</legend><div className="space-y-1.5 text-sm">
        {TIE_POLICIES.map(([id, label]) => <label key={id} className="flex gap-2"><input type="radio" name="tie-policy" checked={policy.tie_policy === id} onChange={() => editPolicy({ tie_policy: id })} />{label}</label>)}
      </div></fieldset>
      <dl className="grid gap-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground md:grid-cols-3">
        {Object.entries(fixedLabels).map(([key, [label, values]]) => <div key={key}><dt>{label}</dt><dd className="font-medium text-foreground">{values[snapshot.ranking_policy?.fixed[key] ?? Object.keys(values)[0]] ?? "고정"}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">위 세 가지는 실행 계층이 증명한 값만 쓸 수 있어 고정입니다.</p>
      {ranking && policyProblem && <p role="alert" className="text-sm text-destructive">{policyProblem}</p>}
      {ranking && <button type="button" className={button} onClick={() => onRanking(undefined)}>순위 정책 변경 취소</button>}
    </section>
  </div>;
}
