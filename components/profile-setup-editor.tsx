"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Database, Layers3, ListFilter, Loader2, RefreshCw, Save, Search, Settings2, ShieldCheck, Users } from "lucide-react";
import { ProfileFieldConnection } from "@/components/profile-field-connection";
import {
  applyMessage, applyingSettings, coverageChange, databaseColumnStatus, databaseColumns, editableField, editCount, emptyChanges, errorMessage, fieldChange, filterDatabaseColumns, replaceChange, switchCoverageMode,
  type ApplyJob, type CoverageChange, type SetupChanges, type SetupSnapshot, type ValueRow,
} from "@/lib/profile-setup";

const input = "settings-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60";
const button = "settings-button inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";
const labels: Record<string, string> = {
  gender: "성별", cart: "장바구니", login: "접속", purchase_absence: "구매 이력 없음", consent: "수신 동의",
  campaign_contact: "캠페인 접촉", offer_response: "캠페인 반응", buy_response: "구매 전환", coupon_used: "쿠폰 사용",
};
const operators: Record<string, string> = { "=": "같음", "!=": "다름", "<": "미만", "<=": "이하", ">": "초과", ">=": "이상", in: "목록에 포함", not_in: "목록에서 제외", starts_with: "문자로 시작", ends_with: "문자로 끝남", contains: "문자 포함" };

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
  const [selectedField, setSelected] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [browseMode, setBrowseMode] = useState<"database" | "settings">("database");
  const [tableFilter, setTableFilter] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tab, setTab] = useState<"fields" | "coverage" | "basics">("fields");
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [validated, setValidated] = useState(false);
  const [applyJob, setApplyJob] = useState<ApplyJob | null>(null);
  const [databaseTarget, setDatabaseTarget] = useState("");
  const applying = applyingSettings(applyJob);
  const count = editCount(changes);

  async function load(preserveMessage = false) {
    setBusy("load"); setError("");
    try {
      const response = await fetch("/api/profile-setup", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setSnapshot(payload); setChanges(emptyChanges()); setValidated(false);
      setApplyJob(payload.apply?.job ?? null);
      setDatabaseTarget(payload.database?.selected ?? "");
      const nextSelected = selected && payload.fields[selected] ? selected : Object.keys(payload.fields).find((id) => payload.fields[id].label && editableField(payload.fields[id])) ?? "";
      const columns = databaseColumns(payload);
      if (!columns.some((column) => column.key === selectedColumn)) {
        setSelectedColumn(columns.find((column) => column.field_ids.includes(nextSelected))?.key ?? "");
      }
      if (!preserveMessage) setMessage("");
      setSelected(nextSelected);
    } catch (error) { setError(error instanceof Error ? error.message : "설정을 불러오지 못했습니다."); }
    finally { setBusy(null); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!applying || !applyJob) return;
    const controller = new AbortController();
    const jobId = applyJob.id;
    const deadline = Date.now() + 12 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (controller.signal.aborted) return;
      if (Date.now() > deadline) {
        setError("적용 상태 확인 시간이 초과되었습니다. 새로 불러오기로 서버의 진행 상태를 확인해 주세요.");
        return;
      }
      try {
        const response = await fetch("/api/profile-setup/apply", { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const payload = await response.json();
          const job: ApplyJob | null = payload.job;
          if (!job || job.id !== jobId) {
            setError("다른 적용 작업이 감지되었습니다. 설정을 새로 불러와 확인하세요.");
            return;
          }
          setApplyJob(job);
          if (job.status === "ready") { await load(true); return; }
          if (job.status === "failed") return;
        }
      } catch {
        // The connection briefly drops during restart. Only a ready job proves success.
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [applying, applyJob?.id]);
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
        setMessage(payload.restart_required ? "관련 설정을 저장했습니다. ‘설정 갱신·적용’을 누르면 조회에 반영됩니다." : "변경할 내용이 없습니다.");
        await load(true);
      } else {
        setValidated(true);
        setMessage(payload.changed_files.length ? `검사를 통과했습니다. 관련 설정 ${payload.changed_files.length}개 파일을 함께 저장할 수 있습니다.` : "현재 설정과 같습니다.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); setValidated(false); }
    finally { setBusy(null); }
  }

  async function applySettings() {
    if (!snapshot || count || applying) return;
    setBusy("apply"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile-setup/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: snapshot.revision }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setApplyJob(payload);
    } catch (error) { setError(error instanceof Error ? error.message : "설정을 적용하지 못했습니다."); }
    finally { setBusy(null); }
  }

  const browsableFields = snapshot ? Object.entries(snapshot.fields).filter(([id]) => !id.startsWith("_")) : [];
  async function selectDatabase() {
    if (!snapshot?.database || count || applying || databaseTarget === snapshot.database.selected) return;
    setBusy("database"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile-setup/database", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: snapshot.revision, database_revision: snapshot.database.revision, target: databaseTarget }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setApplyJob(payload);
    } catch (error) { setError(error instanceof Error ? error.message : "DB를 선택하지 못했습니다."); }
    finally { setBusy(null); }
  }

  const visibleFields = browsableFields.filter(([, field]) => editableField(field));
  const filteredFields = browsableFields.filter(([id, item]) => (!sourceFilter || item.source === sourceFilter) && `${id} ${item.label ?? ""} ${item.column}`.toLowerCase().includes(query.trim().toLowerCase()));
  const columns = snapshot ? databaseColumns(snapshot) : [];
  const filteredColumns = snapshot ? filterDatabaseColumns(columns, snapshot.fields, query, tableFilter, changes.fields) : [];
  const column = filteredColumns.find((item) => item.key === selectedColumn) ?? filteredColumns[0];
  const selected = browseMode === "database"
    ? (column?.field_ids.includes(selectedField) ? selectedField : column?.field_ids[0] ?? "")
    : (filteredFields.some(([id]) => id === selectedField) ? selectedField : filteredFields[0]?.[0] ?? "");
  const field = snapshot?.fields[selected];
  const editable = field ? editableField(field) : false;
  const current = field ? changes.fields.find((item) => item.id === selected) ?? fieldChange(selected, field) : null;
  const domainId = current?.value_domain;
  const pendingDomain = changes.domains.find((item) => item.id === domainId);
  const domain = domainId ? snapshot?.domains[domainId] ?? (pendingDomain ? { label: current?.label || "새 값 목록", editable: true, values: pendingDomain.values } : null) : null;
  const domainValues = domainId ? changes.domains.find((item) => item.id === domainId)?.values ?? domain?.values ?? [] : [];
  const basics = changes.basics ?? (snapshot ? {
    active_column: snapshot.basics.active_state.column ?? "", active_value: snapshot.basics.active_state.value ?? null } : undefined);

  return <section className="settings-editor space-y-5" aria-label="현재 배포 설정">
    <div className="settings-overview">
      <div className="settings-overview-heading">
      <span className="settings-profile-icon"><Database size={25} strokeWidth={1.7} aria-hidden /></span>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">현재 배포 프로필</p><h2>{snapshot?.profile ?? (busy ? "불러오는 중" : "설정을 불러오지 못했습니다")}</h2>
        {snapshot && <p className="mt-1 text-xs text-muted-foreground">고객 테이블 <span className="font-mono">{snapshot.subject.table}</span> · 고객 구분 <span className="font-mono">{snapshot.subject.key}</span></p>}
      </div>
      </div>
      <div className="settings-overview-actions"><button className={button} type="button" disabled={!!busy || applying || !!count || !snapshot?.apply?.available}
        title={count ? "편집한 내용을 먼저 저장하세요." : !snapshot?.apply?.available ? "API의 자동 적용 기능을 활성화해야 합니다." : "검색 인덱스를 갱신하고 API를 재시작합니다."}
        onClick={() => void applySettings()}>{applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}설정 갱신·적용</button>
      <button className={button} type="button" disabled={!!busy} onClick={() => {
        if (!count || window.confirm("저장하지 않은 변경을 버리고 다시 불러올까요?")) void load();
      }}><RefreshCw className="h-4 w-4" />새로 불러오기</button></div>
      {snapshot && <div className="settings-summary-grid">
        {[
          { icon: Layers3, label: "설정 가능한 필드", value: visibleFields.length, suffix: "개" },
          { icon: ListFilter, label: "등록된 값 목록", value: Object.keys(snapshot.domains).length, suffix: "개" },
          { icon: ShieldCheck, label: "설정된 조건 유형", value: snapshot.families.filter((family) => !!snapshot.coverage[family]).length, suffix: `/ ${snapshot.families.length}개` },
        ].map(({ icon: Icon, label, value, suffix }) => <div key={label}><Icon size={19} aria-hidden /><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>)}
      </div>}
    </div>

    <div className="settings-workflow" aria-label="설정 작업 순서">
      <span><b>01</b>필드와 조건 편집</span><ArrowRight size={15} aria-hidden />
      <span><b>02</b>변경 검사 및 저장</span><ArrowRight size={15} aria-hidden />
      <span><b>03</b>설정 갱신·적용</span>
    </div>

    {snapshot?.restart_required && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">저장한 설정의 적용이 필요합니다.</p>
      <p className="mt-1">‘설정 갱신·적용’을 누르면 검색 준비와 서버 재시작을 진행합니다. 완료할 때까지 타겟 조회가 잠시 중단됩니다.</p>
    </div>}
    {applyJob && (applyJob.status !== "ready" || applyJob.revision === snapshot?.revision) && <p role={applyJob.status === "failed" ? "alert" : "status"} className="flex gap-2 rounded-xl border border-border bg-muted p-4 text-sm">
      {applying && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}{applyMessage(applyJob)}
    </p>}
    {error && <p role="alert" className="whitespace-pre-wrap rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="flex gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}
    {busy === "load" && !snapshot && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />현재 설정을 불러오고 있습니다.</p>}

    {snapshot?.database && <section className="rounded-xl border border-border bg-card p-5" aria-label="조회 DB 선택">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Database size={18} aria-hidden />조회 DB</h3>
      <p className="mt-2 text-sm">현재 연결: <strong>{snapshot.database.options.find((option) => option.id === snapshot.database?.selected)?.label ?? "확인 필요"}</strong></p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm">연결할 DB
          <select className={input} value={databaseTarget} disabled={!!busy || applying || !!count || !snapshot.database.available || snapshot.restart_required}
            onChange={(event) => setDatabaseTarget(event.target.value)}>
            {snapshot.database.options.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.database}</option>)}
          </select>
        </label>
        <button type="button" className={button} onClick={() => void selectDatabase()}
          disabled={!!busy || applying || !!count || !snapshot.database.available || snapshot.restart_required || databaseTarget === snapshot.database.selected}>
          {busy === "database" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}DB 연결 전환
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">연결과 데이터 구조를 검사한 뒤 전환합니다. 전환 중에는 조회가 잠시 중단됩니다.</p>
      {(!!count || snapshot.restart_required) && <p className="mt-2 text-xs text-muted-foreground">편집한 설정을 저장하고 적용한 뒤 DB를 전환하세요.</p>}
    </section>}

    {snapshot && <fieldset disabled={!!busy || applying} className="min-w-0 space-y-4 disabled:opacity-70">
      <nav aria-label="설정 종류" className="settings-editor-tabs">
        {([ ["fields", "필드와 값", Layers3], ["coverage", "지원하는 조건", ShieldCheck], ["basics", "고객 기본 조건", Users] ] as const).map(([id, label, Icon]) =>
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={17} aria-hidden />{label}</button>)}
      </nav>

      {tab === "fields" && <div className="settings-fields-layout">
        <aside className="settings-field-list">
          <div className="settings-list-heading"><h2>{browseMode === "database" ? "DB 컬럼 목록" : "설정 필드 목록"}</h2><span>{browseMode === "database" ? filteredColumns.length : filteredFields.length}개</span></div>
          <div className="mb-3 flex gap-1" role="group" aria-label="목록 기준">
            {([["database", "DB 기준"], ["settings", "설정 기준"]] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={browseMode === mode} className={`${button} flex-1 ${browseMode === mode ? "bg-primary/10 text-primary" : ""}`} onClick={() => setBrowseMode(mode)}>{label}</button>)}
          </div>
          {browseMode === "database" ? <label className="mb-3 flex flex-col gap-1.5 text-xs text-muted-foreground">DB 테이블
            <select className={input} value={tableFilter} onChange={(event) => setTableFilter(event.target.value)}>
              <option value="">모든 테이블</option>{snapshot.database_schema?.tables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}
            </select>
          </label> : <label className="mb-3 flex flex-col gap-1.5 text-xs text-muted-foreground">설정할 정보
            <select className={input} value={sourceFilter} onChange={(event) => {
              const source = event.target.value;
              setSourceFilter(source);
              const first = browsableFields.find(([, item]) => (!source || item.source === source) && item.label) ?? browsableFields.find(([, item]) => !source || item.source === source);
              if (first) setSelected(first[0]);
            }}>
              <option value="">모든 정보</option>{[...new Set(browsableFields.map(([, item]) => item.source))].map((source) => <option key={source} value={source}>{source === snapshot.subject.name ? snapshot.subject.label || "고객" : snapshot.sources[source]?.label || source}</option>)}
            </select>
          </label>}
          <label className="relative block"><span className="sr-only">필드 검색</span><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input className={`${input} pl-8`} placeholder="이름·테이블·컬럼 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          {browseMode === "database" && <p className="mt-2 text-xs text-muted-foreground">현재 프로필에 등록된 DB 스키마 기준입니다.</p>}
          <div className="settings-field-options">
            {browseMode === "database" && !snapshot.database_schema ? <p className="settings-empty">DB 스키마 목록을 불러오지 못했습니다. API를 업데이트한 뒤 새로 불러오거나 설정 기준으로 확인하세요.</p>
              : (browseMode === "database" ? filteredColumns : filteredFields).length === 0 && <p className="settings-empty">검색 결과가 없습니다.<br />다른 이름이나 컬럼을 입력해 보세요.</p>}
            {browseMode === "database" ? filteredColumns.map((item) => <button key={item.key} type="button" onClick={() => setSelectedColumn(item.key)} aria-pressed={column?.key === item.key} className="settings-field-option">
              <span className="block truncate text-sm font-medium" title={item.name}>{item.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground" title={item.table}>{item.table}</span>
              <span className={`text-[10px] ${["고객·사건 연결 필요", "필드 의미 설정 필요"].includes(databaseColumnStatus(item, snapshot.fields)) ? "font-medium text-red-600" : "text-muted-foreground"}`}>{databaseColumnStatus(item, snapshot.fields)}</span>
            </button>) : filteredFields.map(([id, item]) =>
              <button key={id} type="button" onClick={() => setSelected(id)} aria-pressed={selected === id} className="settings-field-option">
                <span className="block truncate text-sm font-medium">{changes.fields.find((change) => change.id === id)?.label || item.label || item.column}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.source} · {item.column}</span>
                {item._onboarding_gaps && <span className="text-[10px] text-amber-700">설정 미완료</span>}
                {!editableField(item) && <span className="ml-1 text-[10px] text-muted-foreground">읽기 전용</span>}
              </button>)}
          </div>
        </aside>
        <div className="settings-field-detail">
          {browseMode === "database" && column && <div className="mb-5 space-y-3 border-b border-border pb-5">
            <div><h2 className="break-all font-semibold">{column.name}</h2><p className="mt-1 break-all text-xs text-muted-foreground">{[column.database, column.table].filter(Boolean).join(" · ")} · {column.data_type ?? "자료형 미확인"}{column.primary_key ? " · 기본 키" : ""}{column.nullable === true ? " · NULL 허용" : column.nullable === false ? " · NULL 불가" : ""}</p></div>
            {column.field_ids.length > 0 ? <label className="flex flex-col gap-1.5 text-sm">연결된 설정
              <select className={input} value={selected} onChange={(event) => setSelected(event.target.value)}>{column.field_ids.map((id) => <option key={id} value={id}>{changes.fields.find((item) => item.id === id)?.label || snapshot.fields[id]?.label || id} ({snapshot.fields[id]?.source})</option>)}</select>
            </label> : <p className="text-sm text-muted-foreground">{column.structural_roles?.length ? "고객·사건의 연결 또는 시간 기준으로 사용되는 컬럼입니다. 조건 값 설정은 별도로 추가할 수 있습니다." : "조건으로 사용할 고객·사건 연결이 필요합니다."}{snapshot.field_connections?.some((option) => option.table === column.table && option.column === column.name) ? " 아래에서 필드 연결을 추가할 수 있습니다." : ""}</p>}
            {!!column.structural_roles?.length && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">관계·기준 연결 확인</summary><ul className="mt-2 space-y-1 break-all">{column.structural_roles.map((role) => <li key={role}>{role}</li>)}</ul></details>}
            <ProfileFieldConnection key={column.key} column={column} options={snapshot.field_connections ?? []} domains={snapshot.domains}
              pending={changes.new_fields} onChange={(new_fields) => update({ ...changes, new_fields })} />
          </div>}
          {field && current ? <div className="space-y-5">
            <div className="settings-detail-heading"><span className="settings-detail-icon"><Settings2 size={20} aria-hidden /></span><div><h2>{field.label || field.column}</h2><p>{field.source} · {field.column} · {field.data_type}</p></div><span className="settings-type-badge">{field.data_type}</span></div>
            {!editable && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">이 설정은 다른 테이블을 참조하거나 계산에 사용하는 읽기 전용 필드입니다. 변경은 프로필 설정에서 관리합니다.</p>}
            <fieldset disabled={!editable} className="min-w-0 space-y-5">
            <TextField label="이 필드를 부르는 이름" value={current.label} onChange={(label) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, label }, (item) => item.id === selected) })} />
            <TextField label="저장된 값의 의미" value={current.semantic_description ?? ""} onChange={(semantic_description) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, semantic_description }, (item) => item.id === selected) })} />
            <fieldset><legend className="mb-2 text-sm font-medium">허용할 비교</legend><div className="settings-operator-list">{Object.entries(operators).filter(([op]) => !["starts_with", "ends_with", "contains"].includes(op) || (field.data_type === "string" && !current.value_domain)).map(([op, label]) => <label key={op}><input type="checkbox" checked={current.allowed_operators.includes(op)} onChange={(event) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, allowed_operators: event.target.checked ? [...current.allowed_operators, op] : current.allowed_operators.filter((value) => value !== op) }, (item) => item.id === selected) })} />{label}</label>)}</div></fieldset>
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
                  <div className="grid gap-3 lg:grid-cols-2"><TextField label="값의 이름" hint="이 값의 뜻을 나타내는 대표 이름 하나를 입력하세요." value={value.label} onChange={(label) => changeValue({ ...value, label })} />
                    <div className="space-y-1.5"><p className="text-sm font-medium">DB 저장값</p><ValueInput value={value.physical} onChange={(physical) => changeValue({ ...value, physical })} /></div></div>
                  <TextField label="의미 설명 (선택)" hint="이름만으로 모호할 때 업무상 의미를 설명하세요. 동의어는 나열하지 않아도 됩니다." value={value.description} onChange={(description) => changeValue({ ...value, description })} />
                  {index >= (snapshot.domains[domainId]?.values.length ?? 0) && <button type="button" className="text-xs text-destructive underline" onClick={() => update({ ...changes, domains: replaceChange(changes.domains, { ...pendingDomain, id: domainId, values: domainValues.filter((_, position) => position !== index) }, (item) => item.id === domainId) })}>추가한 값 취소</button>}
                </fieldset>;
              })}
              {domain.editable && <button type="button" className={button} onClick={() => update({ ...changes, domains: replaceChange(changes.domains, { ...pendingDomain, id: domainId, values: [...domainValues, { canonical: "", physical: "", label: "", description: "" }] }, (item) => item.id === domainId) })}>값 추가</button>}
            </div>}
            {!domain && <div className="space-y-2 rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">정해진 코드나 등급을 사용하는 필드라면 값 목록을 연결하세요. 연결하면 목록에 등록한 값만 허용합니다.</p>
              <select aria-label="기존 값 목록 연결" className={input} value="" onChange={(event) => update({ ...changes, fields: replaceChange(changes.fields, { ...current, value_domain: event.target.value || null }, (item) => item.id === selected) })}>
                <option value="">기존 목록 선택</option>{Object.entries(snapshot.domains).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
              </select>
              <button type="button" className={button} onClick={() => {
                const id = `setup.${selected}`;
                update({ ...changes, fields: replaceChange(changes.fields, { ...current, value_domain: id }, (item) => item.id === selected),
                  domains: [...changes.domains, { id, field_id: selected, values: [{ canonical: "", physical: "", label: "", description: "" }] }] });
              }}>새 값 목록 만들기</button>
            </div>}
            </fieldset>
          </div> : !(browseMode === "database" && column) && <p className="text-sm text-muted-foreground">확인할 필드나 컬럼을 선택하세요.</p>}
        </div>
      </div>}

      {tab === "coverage" && <div className="settings-coverage space-y-3"><div className="settings-section-intro"><ShieldCheck size={23} aria-hidden /><div><h2>어떤 조건을 지원하나요?</h2><p>조건별 지원 여부와 근거가 되는 필드·사건을 설정하세요. 선택 전에는 미설정 상태를 유지합니다.</p></div></div>
        {snapshot.families.map((family) => {
          const raw = snapshot.coverage[family];
          const value = changes.coverage.find((item) => item.family === family) ?? coverageChange(family, raw);
          const changed = changes.coverage.some((item) => item.family === family);
          const change = (next: CoverageChange) => update({ ...changes, coverage: replaceChange(changes.coverage, next, (item) => item.family === family) });
          return <details key={family} className="settings-coverage-card"><summary>{labels[family] ?? family}<span className={`settings-coverage-status ${!raw && !changed ? "is-unset" : value.mode === "unsupported" ? "is-unsupported" : "is-supported"}`}>{!raw && !changed ? "미설정" : value.mode === "unsupported" ? "지원 안 함" : "지원"}{changed ? " · 변경됨" : ""}</span></summary>
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

      {tab === "basics" && basics && <div className="settings-basics space-y-5">
        <div className="settings-section-intro"><Users size={23} aria-hidden /><div><h2>조회 대상의 기본 고객 상태</h2><p>기본 조회 대상에 적용할 고객 상태를 설정합니다. 나이 등 개별 조건은 ‘필드와 값’에서 확인하세요.</p></div></div>
        <TextField label="기본 고객 상태 컬럼" value={basics.active_column} onChange={(active_column) => update({ ...changes, basics: { ...basics, active_column } })} />
        <div className="space-y-1.5"><p className="text-sm font-medium">기본 고객 상태값</p><ValueInput value={basics.active_value} onChange={(active_value) => update({ ...changes, basics: { ...basics, active_value } })} /></div>
      </div>}
    </fieldset>}

    {snapshot && <div className="settings-save-bar">
      <div className="settings-save-status"><span className={count ? "has-changes" : ""} /><div><p className="text-sm font-medium" aria-live="polite">{count ? `${count}개 항목 변경 중` : "저장하지 않은 변경 없음"}</p><p className="text-xs text-muted-foreground">검사 후 관련 설정을 함께 저장합니다.</p></div></div>
      <div className="flex gap-2"><button type="button" className={button} disabled={!!busy || applying || count === 0} onClick={() => void submit(false)}>{busy === "validate" && <Loader2 className="h-4 w-4 animate-spin" />}변경 검사</button>
        <button type="button" className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`} disabled={!!busy || applying || !validated || count === 0} onClick={() => void submit(true)}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}설정 저장</button></div>
    </div>}
  </section>;
}
