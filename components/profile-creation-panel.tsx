"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { DRIVERS, creationError, numericColumn, type ProfileCreateRequest, type ProfileTable } from "@/lib/profile-declarations";
import { errorMessage, type SetupSnapshot } from "@/lib/profile-setup";

const input = "settings-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "settings-button inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";

/** A DB the deployment lists without a profile yet: read its tables and name the subject. */
export function ProfileCreationPanel({ snapshot, disabled, onCreated }: {
  snapshot: SetupSnapshot; disabled: boolean; onCreated: (message: string) => void;
}) {
  const pending = (snapshot.database?.options ?? []).filter((option) => option.ready === false);
  const [target, setTarget] = useState(pending[0]?.id ?? "");
  const [driver, setDriver] = useState<ProfileCreateRequest["driver"]>("pymysql");
  const [tables, setTables] = useState<ProfileTable[] | null>(null);
  const [request, setRequest] = useState<ProfileCreateRequest | null>(null);
  const [busy, setBusy] = useState<"inspect" | "create" | null>(null);
  const [error, setError] = useState("");
  if (!pending.length) return null;
  const option = pending.find((item) => item.id === target);
  const subject = tables?.find((table) => table.name === request?.subject_table);
  const change = (patch: Partial<ProfileCreateRequest>) => { if (request) setRequest({ ...request, ...patch }); setError(""); };

  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(payload));
    return payload;
  }

  async function inspect() {
    setBusy("inspect"); setError(""); setTables(null); setRequest(null);
    try {
      const payload = await post("/api/profile-setup/profiles/inspect", { target, driver });
      const read: ProfileTable[] = payload.tables;
      setTables(read);
      setRequest({ target, driver, tables: read.map((table) => table.name), subject_table: "", subject_key: "", subject_label: "",
        age_column: null, active_column: null, active_value: null });
    } catch (problem) { setError(problem instanceof Error ? problem.message : "DB 구조를 읽지 못했습니다."); }
    finally { setBusy(null); }
  }

  async function create() {
    if (!request || !tables) return;
    const problem = creationError(request, tables);
    if (problem) { setError(problem); return; }
    setBusy("create"); setError("");
    try {
      const payload = await post("/api/profile-setup/profiles", request);
      onCreated(`프로필 ${payload.profile}을(를) 만들었습니다. 위의 ‘연결할 DB’에서 ${option?.label ?? "이 DB"}로 전환하면 새 프로필의 필드·사건·지표를 이어서 설정할 수 있습니다.`);
      setTables(null); setRequest(null);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "프로필을 만들지 못했습니다."); }
    finally { setBusy(null); }
  }

  return <section className="mt-5 space-y-4 border-t border-border pt-5" aria-label="새 프로필 만들기">
    <div><h4 className="flex items-center gap-2 text-sm font-semibold"><Plus size={16} aria-hidden />새 프로필 만들기</h4>
      <p className="mt-1 text-xs text-muted-foreground">DB 목록에 있지만 아직 설정이 없는 DB입니다. 접속 정보는 서버 설정에만 있고, 여기서는 표 구조를 읽기 전용으로 읽어 조회 대상만 정합니다.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">DB
        <select className={input} value={target} disabled={disabled || !!busy} onChange={(event) => { setTarget(event.target.value); setTables(null); setRequest(null); }}>
          {pending.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.database} → 프로필 {item.profile}</option>)}
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1.5 text-sm">DB 종류
        <select className={input} value={driver} disabled={disabled || !!busy} onChange={(event) => { setDriver(event.target.value as ProfileCreateRequest["driver"]); setTables(null); setRequest(null); }}>
          {DRIVERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button type="button" className={button} disabled={disabled || !!busy || !target} onClick={() => void inspect()}>
        {busy === "inspect" && <Loader2 className="h-4 w-4 animate-spin" />}DB 구조 읽기</button>
    </div>
    {tables && request && <div className="space-y-4 rounded-xl border border-border p-4">
      <p className="text-sm">표 {tables.length}개를 읽었습니다.</p>
      <fieldset><legend className="mb-2 text-sm font-medium">가져올 표</legend>
        <div className="grid max-h-48 gap-1 overflow-auto rounded-lg border border-border p-3 text-sm md:grid-cols-2">
          {tables.map((table) => <label key={table.name} className="flex gap-2"><input type="checkbox" checked={request.tables.includes(table.name)}
            onChange={(event) => change({ tables: event.target.checked ? [...request.tables, table.name] : request.tables.filter((name) => name !== table.name) })} />
            <span className="font-mono">{table.name}</span><span className="text-xs text-muted-foreground">{table.primary_key.length ? `기본 키 ${table.primary_key.join(", ")}` : "기본 키 없음"}</span></label>)}
        </div>
      </fieldset>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">조회 대상(주체) 표
          <select className={input} value={request.subject_table} onChange={(event) => {
            const table = tables.find((item) => item.name === event.target.value);
            change({ subject_table: event.target.value, subject_key: table?.primary_key.length === 1 ? table.primary_key[0] : "",
              age_column: null, active_column: null, active_value: null });
          }}><option value="">선택하세요</option>{tables.filter((table) => table.primary_key.length === 1).map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}</select>
          <span className="text-xs text-muted-foreground">한 행이 조회 대상 한 명(한 건)인 표입니다.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">주체 키<input className={`${input} font-mono`} value={request.subject_key} disabled /></label>
        <label className="flex flex-col gap-1.5 text-sm">주체를 부르는 이름<input className={input} value={request.subject_label} placeholder="예: 고객, 직원, 회원" onChange={(event) => change({ subject_label: event.target.value })} /></label>
      </div>
      {subject && <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">나이 컬럼
          <select className={input} value={request.age_column ?? ""} onChange={(event) => change({ age_column: event.target.value || null })}>
            <option value="">없음(나이 조건을 닫음)</option>{subject.columns.filter((column) => numericColumn(column.type)).map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">활성 상태 컬럼
          <select className={input} value={request.active_column ?? ""} onChange={(event) => change({ active_column: event.target.value || null, active_value: event.target.value ? request.active_value ?? "" : null })}>
            <option value="">없음(모든 행이 대상)</option>{subject.columns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
          </select>
        </label>
        {request.active_column !== null && <label className="flex flex-col gap-1.5 text-sm">활성 상태 값<input className={`${input} font-mono`} value={request.active_value ?? ""} placeholder="예: ACTIVE" onChange={(event) => change({ active_value: event.target.value })} /></label>}
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="button" className={`${button} bg-primary text-primary-foreground`} disabled={disabled || !!busy} onClick={() => void create()}>
        {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}프로필 만들기</button>
    </div>}
    {error && !tables && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
