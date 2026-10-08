"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Save, Search } from "lucide-react";
import {
  coverageChange, editCount, emptyChanges, errorMessage, fieldChange, replaceChange, splitTerms, switchCoverageMode,
  type CoverageChange, type SetupChanges, type SetupSnapshot, type ValueRow,
} from "@/lib/profile-setup";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";
const labels: Record<string, string> = {
  gender: "성별", cart: "장바구니", login: "접속", purchase_absence: "구매 이력 없음", consent: "수신 동의",
  campaign_contact: "캠페인 접촉", offer_response: "캠페인 반응", buy_response: "구매 전환", coupon_used: "쿠폰 사용",
};
const operators: Record<string, string> = { "=": "같음", "!=": "다름", "<": "미만", "<=": "이하", ">": "초과", ">=": "이상", in: "목록에 포함", not_in: "목록에서 제외" };

function TextField({ label, value, onChange, hint, disabled }: { label: string; value: string; onChange: (value: string) => void; hint?: string; disabled?: boolean }) {
  return <label className="flex flex-col gap-1.5 text-sm font-medium">{label}
    <input className={input} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
  </label>;
}

function ValueInput({ value, onChange }: { value: ValueRow["physical"]; onChange: (value: ValueRow["physical"]) => void }) {
  const type = value === null ? "null" : typeof value;
  return <div className="flex gap-1">
    <select aria-label="저장값의 자료형" className={`${input} max-w-24`} value={type} onChange={(event) => {
      const next = event.target.value;
      onChange(next === "null" ? null : next === "boolean" ? false : next === "number" ? 0 : "");
    }}>
      <option value="string">문자</option><option value="number">정수</option><option value="boolean">참/거짓</option><option value="null">NULL</option>
    </select>
    {typeof value === "boolean" ? <select aria-label="DB 저장값" className={input} value={String(value)} onChange={(event) => onChange(event.target.value === "true")}>
      <option value="true">참</option><option value="false">거짓</option>
    </select> : <input aria-label="DB 저장값" className={input} value={value === null ? "NULL" : value} disabled={value === null}
      type={typeof value === "number" ? "number" : "text"} step="1" onChange={(event) => {
        if (typeof value === "number") {
          const number = Number(event.target.value);
          if (event.target.value !== "" && Number.isSafeInteger(number)) onChange(number);
        } else onChange(event.target.value);
      }} />}
  </div>;
}

function TermsInput({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [text, setText] = useState(values.join(", "));
  return <TextField label={label} hint="같은 뜻의 낱말을 쉼표로 구분하세요." value={text} onChange={(next) => { setText(next); onChange(splitTerms(next)); }} />;
}

function MultiSelect({ label, options, selected, onChange }: { label: string; options: [string, string][]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">{label}</legend>
    <div className="max-h-40 space-y-1.5 overflow-auto rounded-lg border border-border p-3">
      {options.map(([id, title]) => <label key={id} className="flex gap-2 text-sm">
        <input type="checkbox" checked={selected.includes(id)} onChange={(event) => onChange(event.target.checked ? [...selected, id] : selected.filter((item) => item !== id))} />
        <span>{title}</span>
      </label>)}
      {options.length === 0 && <p className="text-xs text-muted-foreground">선택할 항목이 없습니다.</p>}
    </div>
  </fieldset>;
}

export function ProfileSetupEditor() {
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
  const [changes, setChanges] = useState<SetupChanges>(emptyChanges);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tab, setTab] = useState<"fields" | "coverage" | "basics">("fields");
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [validated, setValidated] = useState(false);
  const count = editCount(changes);

  async function load(preserveMessage = false) {
    setBusy("load"); setError("");
    try {
      const response = await fetch("/api/profile-setup", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setSnapshot(payload); setChanges(emptyChanges()); setValidated(false);
      const nextSelected = selected && payload.fields[selected] ? selected : Object.keys(payload.fields).find((id) => payload.fields[id].label && !payload.fields[id].expression) ?? "";
      setSourceFilter(payload.fields[nextSelected]?.source ?? payload.subject.name ?? "");
      if (!preserveMessage) setMessage("");
      setSelected(nextSelected);
    } catch (error) { setError(error instanceof Error ? error.message : "설정을 불러오지 못했습니다."); }
    finally { setBusy(null); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!count) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);

  function update(next: SetupChanges) { setChanges(next); setValidated(false); setMessage(""); setError(""); }

  async function submit(save: boolean) {
    if (!snapshot) return;
    setBusy(save ? "save" : "validate"); setError(""); setMessage("");
    try {
      const response = await fetch(save ? "/api/profile-setup" : "/api/profile-setup/validate", {
        method: save ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: snapshot.revision, ...changes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      if (save) {
        setMessage(payload.restart_required ? "관련 설정을 저장했습니다. API를 재시작하면 적용됩니다." : "변경할 내용이 없습니다.");
        await load(true);
      } else {
        setValidated(true);
        setMessage(payload.changed_files.length ? `검사를 통과했습니다. 관련 설정 ${payload.changed_files.length}개 파일을 함께 저장할 수 있습니다.` : "현재 설정과 같습니다.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); setValidated(false); }
    finally { setBusy(null); }
  }

  const visibleFields = snapshot ? Object.entries(snapshot.fields).filter(([id, field]) => !id.startsWith("_") && field.semantic_visibility !== "lowering_only" && !field.expression) : [];
  const field = snapshot?.fields[selected];
  const current = field ? changes.fields.find((item) => item.id === selected) ?? fieldChange(selected, field) : null;
  const domainId = current?.value_domain;
  const pendingDomain = changes.domains.find((item) => item.id === domainId);
  const domain = domainId ? snapshot?.domains[domainId] ?? (pendingDomain ? { label: current?.label || "새 값 목록", editable: true, values: pendingDomain.values } : null) : null;
  const domainValues = domainId ? changes.domains.find((item) => item.id === domainId)?.values ?? domain?.values ?? [] : [];
  const basics = changes.basics ?? (snapshot ? { age_column: snapshot.basics.base_entity.age_column,
    active_column: snapshot.basics.active_state.column ?? "", active_value: snapshot.basics.active_state.value ?? null } : undefined);

  return <section className="space-y-5" aria-label="현재 배포 설정">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div><p className="text-xs text-muted-foreground">현재 배포</p><p className="font-semibold">{snapshot?.profile ?? "불러오는 중"}</p>
        {snapshot && <p className="mt-1 text-xs text-muted-foreground">고객 테이블 {snapshot.subject.table} · 고객 구분 {snapshot.subject.key}</p>}
      </div>
      <button className={button} type="button" disabled={!!busy} onClick={() => {
        if (!count || window.confirm("저장하지 않은 변경을 버리고 다시 불러올까요?")) void load();
      }}><RefreshCw className="h-4 w-4" />새로 불러오기</button>
    </div>

    {snapshot?.restart_required && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">저장한 설정이 재시작을 기다리고 있습니다.</p>
      <p className="mt-1">서로 다른 설정으로 실행되지 않도록 타겟 조회를 잠시 막았습니다. API를 재시작한 뒤 이 화면을 새로 불러오세요.</p>
      <p className="mt-1">벡터 검색을 사용하는 배포는 초기 연결 안내에 따라 카탈로그 인덱스를 갱신한 뒤 재시작하세요.</p>
      <code className="mt-2 block select-all text-xs">docker compose restart api</code>
    </div>}
    {error && <p role="alert" className="whitespace-pre-wrap rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="flex gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}
    {busy === "load" && !snapshot && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />현재 설정을 불러오고 있습니다.</p>}

    {snapshot && <fieldset disabled={!!busy} className="min-w-0 space-y-4 disabled:opacity-70">
      <nav aria-label="설정 종류" className="flex gap-1 rounded-xl bg-muted p-1">
        {([ ["fields", "필드와 값"], ["coverage", "지원하는 조건"], ["basics", "고객 기본 조건"] ] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === id ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}
      </nav>

      {tab === "fields" && <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-xl border border-border p-3">
          <label className="mb-3 flex flex-col gap-1.5 text-xs text-muted-foreground">설정할 정보
            <select className={input} value={sourceFilter} onChange={(event) => {
              const source = event.target.value;
              setSourceFilter(source);
              const first = visibleFields.find(([, item]) => (!source || item.source === source) && item.label) ?? visibleFields.find(([, item]) => !source || item.source === source);
              if (first) setSelected(first[0]);
            }}>
              <option value="">모든 정보</option>{[...new Set(visibleFields.map(([, item]) => item.source))].map((source) => <option key={source} value={source}>{source === snapshot.subject.name ? snapshot.subject.label || "고객" : snapshot.sources[source]?.label || source}</option>)}
            </select>
          </label>
          <label className="relative block"><span className="sr-only">필드 검색</span><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input className={`${input} pl-8`} placeholder="이름이나 컬럼 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="mt-3 max-h-48 space-y-1 overflow-x-hidden overflow-y-auto md:max-h-[580px]">
            {visibleFields.filter(([id, item]) => (!sourceFilter || item.source === sourceFilter) && `${id} ${item.label ?? ""} ${item.column}`.toLowerCase().includes(query.toLowerCase())).map(([id, item]) =>
              <button key={id} type="button" onClick={() => setSelected(id)} aria-pressed={selected === id} className={`w-full rounded-lg px-3 py-2 text-left ${selected === id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                <span className="block truncate text-sm font-medium">{changes.fields.find((change) => change.id === id)?.label || item.label || item.column}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.source} · {item.column}</span>
                {item._onboarding_gaps && <span className="text-[10px] text-amber-700">설정 미완료</span>}
              </button>)}
          </div>
        </aside>
        <div className="min-w-0 rounded-xl border border-border p-5">
          {field && current ? <div className="space-y-5">
            <div><h2 className="font-semibold">{field.label || field.column}</h2><p className="mt-1 text-xs text-muted-foreground">{field.source} · {field.column} · {field.data_type}</p></div>
            <TextField label="이 필드를 부르는 이름" value={current.label} onChange={(label) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, label }, (item) => item.id === selected) })} />
            <fieldset><legend className="mb-2 text-sm font-medium">허용할 비교</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{Object.entries(operators).map(([op, label]) => <label key={op} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={current.allowed_operators.includes(op)} onChange={(event) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, allowed_operators: event.target.checked ? [...current.allowed_operators, op] : current.allowed_operators.filter((value) => value !== op) }, (item) => item.id === selected) })} />{label}</label>)}</div></fieldset>
            {(field.data_type === "number" || current.unit) && <TextField label="단위" hint="숫자만으로 단위를 추측하지 않습니다. 이미 사용 중인 단위는 보호됩니다." disabled={!!field.unit} value={current.unit ?? ""} onChange={(unit) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, unit: unit || null }, (item) => item.id === selected) })} />}
            {field._onboarding_gaps && <label className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" checked={current.enable_draft} onChange={(event) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, enable_draft: event.target.checked }, (item) => item.id === selected) })} />필수 항목을 확인했습니다. 이 필드를 사용하도록 설정합니다.</label>}
            {domain && domainId && <div className="space-y-3 border-t border-border pt-5">
              <div><h3 className="text-sm font-semibold">{domain.label} 값 목록</h3><p className="mt-1 text-xs text-muted-foreground">여기서 한 번 수정하면 이 값 목록을 쓰는 필드에 함께 반영됩니다. 값의 식별자와 기존 문법은 보존됩니다.</p></div>
              {!domain.editable && <p className="text-sm text-muted-foreground">이 목록은 읽기 전용입니다. 원본 선언에서 관리합니다.</p>}
              {domainValues.map((value, index) => {
                const changeValue = (row: ValueRow) => update({ ...changes, domains: replaceChange(changes.domains, { ...pendingDomain, id: domainId, values: domainValues.map((original, position) => position === index ? row : original) }, (item) => item.id === domainId) });
                return <fieldset key={index} disabled={!domain.editable} className="space-y-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-xs text-muted-foreground">{value.canonical}</legend>
                  {index >= (snapshot.domains[domainId]?.values.length ?? 0) && <TextField label="값 식별자" hint="이 값을 구분하는 고유한 이름입니다. 저장 후에는 유지됩니다." value={value.canonical} onChange={(canonical) => changeValue({ ...value, canonical })} />}
                  <div className="grid gap-3 lg:grid-cols-2"><TextField label="표시 이름" value={value.label} onChange={(label) => changeValue({ ...value, label })} />
                    <div className="space-y-1.5"><p className="text-sm font-medium">DB 저장값</p><ValueInput value={value.physical} onChange={(physical) => changeValue({ ...value, physical })} /></div></div>
                  <TermsInput key={`${snapshot.revision}:${domainId}:${index}`} label="같은 뜻의 낱말" values={value.aliases} onChange={(aliases) => changeValue({ ...value, aliases })} />
                  {index >= (snapshot.domains[domainId]?.values.length ?? 0) && <button type="button" className="text-xs text-destructive underline" onClick={() => update({ ...changes, domains: replaceChange(changes.domains, { ...pendingDomain, id: domainId, values: domainValues.filter((_, position) => position !== index) }, (item) => item.id === domainId) })}>추가한 값 취소</button>}
                </fieldset>;
              })}
              {domain.editable && <button type="button" className={button} onClick={() => update({ ...changes, domains: replaceChange(changes.domains, { ...pendingDomain, id: domainId, values: [...domainValues, { canonical: "", physical: "", label: "", aliases: [] }] }, (item) => item.id === domainId) })}>값 추가</button>}
            </div>}
            {!domain && <div className="space-y-2 rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">정해진 코드나 등급을 사용하는 필드라면 값 목록을 연결하세요. 연결하면 목록에 등록한 값만 허용합니다.</p>
              <select aria-label="기존 값 목록 연결" className={input} value="" onChange={(event) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, value_domain: event.target.value || null }, (item) => item.id === selected) })}>
                <option value="">기존 목록 선택</option>{Object.entries(snapshot.domains).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
              </select>
              <button type="button" className={button} onClick={() => {
                const id = `setup.${selected}`;
                update({ ...changes, fields: replaceChange(changes.fields, { ...current, value_domain: id }, (item) => item.id === selected),
                  domains: [...changes.domains, { id, field_id: selected, values: [{ canonical: "", physical: "", label: "", aliases: [] }] }] });
              }}>새 값 목록 만들기</button>
            </div>}
          </div> : <p className="text-sm text-muted-foreground">설정할 필드를 선택하세요.</p>}
        </div>
      </div>}

      {tab === "coverage" && <div className="space-y-3"><p className="text-sm text-muted-foreground">조건마다 지원 여부를 정하고, 근거가 되는 필드나 사건을 선택하세요. 선택 전에는 미설정 상태를 유지합니다.</p>
        {snapshot.families.map((family) => {
          const raw = snapshot.coverage[family];
          const value = changes.coverage.find((item) => item.family === family) ?? coverageChange(family, raw);
          const changed = changes.coverage.some((item) => item.family === family);
          const change = (next: CoverageChange) => update({ ...changes, coverage: replaceChange(changes.coverage, next, (item) => item.family === family) });
          return <details key={family} className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{labels[family] ?? family}<span className="ml-3 text-xs text-muted-foreground">{!raw && !changed ? "미설정" : value.mode === "unsupported" ? "지원 안 함" : "지원"}{changed ? " · 변경됨" : ""}</span></summary>
            <div className="mt-4 space-y-4"><label className="flex flex-col gap-1.5 text-sm">지원 여부<select className={input} value={!raw && !changed ? "" : value.mode} onChange={(event) => { if (event.target.value) change(switchCoverageMode(value, event.target.value as CoverageChange["mode"])); }}>
              <option value="" disabled>선택하세요</option><option value="supported">지원</option><option value="unsupported">지원 안 함</option>
            </select></label>
              {value.mode === "unsupported" ? <TextField label="지원하지 않는 이유" value={value.reason} onChange={(reason) => change({ ...value, reason })} /> : <div className="grid gap-3 md:grid-cols-3">
                <MultiSelect label="회원·사건의 필드" options={visibleFields.map(([id, item]) => [id, `${item.label || item.column} (${item.source})`])} selected={value.fields} onChange={(fields) => change({ ...value, fields })} />
                <MultiSelect label="해당 사건이 있음" options={Object.entries(snapshot.sources).map(([id, source]) => [id, source.label])} selected={value.sources} onChange={(sources) => change({ ...value, sources })} />
                <MultiSelect label="해당 사건이 없음" options={Object.entries(snapshot.sources).map(([id, source]) => [id, source.label])} selected={value.negated_sources} onChange={(negated_sources) => change({ ...value, negated_sources })} />
              </div>}
            </div>
          </details>;
        })}
      </div>}

      {tab === "basics" && basics && <div className="space-y-5 rounded-xl border border-border p-5">
        <p className="text-sm text-muted-foreground">전체 타겟 조회에 쓰는 고객 기본 조건입니다. 컬럼 이름과 저장값을 확인한 뒤 바꾸세요.</p>
        <TextField label="나이 컬럼" value={basics.age_column} onChange={(age_column) => update({ ...changes, basics: { ...basics, age_column } })} />
        <TextField label="기본 고객 상태 컬럼" value={basics.active_column} onChange={(active_column) => update({ ...changes, basics: { ...basics, active_column } })} />
        <div className="space-y-1.5"><p className="text-sm font-medium">기본 고객 상태값</p><ValueInput value={basics.active_value} onChange={(active_value) => update({ ...changes, basics: { ...basics, active_value } })} /></div>
      </div>}
    </fieldset>}

    {snapshot && <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <div><p className="text-sm font-medium">{count ? `${count}개 항목 변경 중` : "저장하지 않은 변경 없음"}</p><p className="text-xs text-muted-foreground">검사 후 관련 설정을 함께 저장합니다.</p></div>
      <div className="flex gap-2"><button type="button" className={button} disabled={!!busy || count === 0} onClick={() => void submit(false)}>{busy === "validate" && <Loader2 className="h-4 w-4 animate-spin" />}변경 검사</button>
        <button type="button" className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`} disabled={!!busy || !validated || count === 0} onClick={() => void submit(true)}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}설정 저장</button></div>
    </div>}
  </section>;
}
