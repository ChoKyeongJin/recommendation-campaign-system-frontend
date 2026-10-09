"use client";

import { useState } from "react";
import { connectionError, replaceChange, type DatabaseColumnRow, type FieldConnection, type NewField, type SetupSnapshot } from "@/lib/profile-setup";

const input = "settings-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "settings-button rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
const operators: Record<string, string> = { "=": "같음", "!=": "다름", "<": "미만", "<=": "이하", ">": "초과", ">=": "이상", in: "목록에 포함", not_in: "목록에서 제외", starts_with: "문자로 시작", ends_with: "문자로 끝남", contains: "문자 포함" };
const blank = (): NewField => ({ binding_id: "", label: "", semantic_description: "", allowed_operators: [], unit: null, value_domain: null, negative_null_policy: "exclude_unknown" });

export function ProfileFieldConnection({ column, options, domains, pending, onChange }: {
  column: DatabaseColumnRow; options: FieldConnection[]; domains: SetupSnapshot["domains"];
  pending: NewField[]; onChange: (fields: NewField[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NewField>(blank);
  const [error, setError] = useState("");
  const choices = options.filter((option) => option.table === column.table && option.column === column.name);
  const staged = pending.filter((field) => choices.some((option) => option.id === field.binding_id));
  const selected = choices.find((option) => option.id === draft.binding_id);
  const change = (patch: Partial<NewField>) => { setDraft({ ...draft, ...patch }); setError(""); };

  if (!choices.length) return column.field_ids.length ? null : <p className="text-sm text-muted-foreground">연결 가능한 고객·사건이 없습니다. 등록된 DB 관계와 고유 키, 지원하는 자료형을 먼저 확인해야 합니다. 현재 화면에서는 기존 고객·사건의 컬럼이나, 등록된 관계로 값 하나를 가져올 수 있는 컬럼을 연결할 수 있습니다.</p>;

  return <div className="my-4 space-y-3" aria-label="새 필드 연결">
    {staged.map((field) => <div key={field.binding_id} className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-medium">{field.label} · {choices.find((option) => option.id === field.binding_id)?.source_label}</p>
      <p className="text-xs text-muted-foreground">저장 대기 중 · 아래의 변경 검사와 설정 저장을 완료하세요.</p>
      <div className="flex gap-2"><button type="button" className={button} onClick={() => { setDraft(field); setOpen(true); setError(""); }}>연결 내용 수정</button>
        <button type="button" className={button} onClick={() => { onChange(pending.filter((item) => item.binding_id !== field.binding_id)); if (draft.binding_id === field.binding_id) setOpen(false); }}>추가 취소</button></div>
    </div>)}
    {!open ? <button type="button" className={button} onClick={() => { setDraft(blank()); setOpen(true); setError(""); }}>필드 연결 추가</button> : <div className="space-y-4 rounded-xl border border-border p-4">
      <div><h3 className="font-semibold">{column.name} 필드 연결</h3><p className="mt-1 text-xs text-muted-foreground">저장된 값의 의미와 이 값을 사용할 고객·사건을 선택하세요. 입력 후 변경 목록에 추가하면 검사·저장할 수 있습니다.</p></div>
      <label className="flex flex-col gap-1.5 text-sm">연결할 고객·사건
        <select className={input} value={draft.binding_id} onChange={(event) => {
          const option = choices.find((item) => item.id === event.target.value);
          const saved = pending.find((item) => item.binding_id === option?.id);
          setDraft(saved ?? { ...draft, binding_id: option?.id ?? "", allowed_operators: option?.allowed_operators.filter((op) => ["=", "!=", "<", "<=", ">", ">="].includes(op)) ?? [], unit: option?.data_type === "number" ? draft.unit : null, value_domain: null });
          setError("");
        }}><option value="">선택하세요</option>{choices.map((option) => <option key={option.id} value={option.id}>{option.source_label} ({option.source}){choices.filter((item) => item.source === option.source).length > 1 ? ` · ${option.keys.map((key) => key.source_column).join(" + ")}` : ""}</option>)}</select>
      </label>
      {selected && <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <p>{selected.source_label}에 연결된 {column.table}의 저장값을 조건에 사용합니다.</p>
        <p className="break-all">{selected.source_table}{selected.kind === "lookup" ? ` → ${selected.table}` : " · 같은 테이블"}</p>
        {selected.keys.map((key) => <p key={`${key.source_column}:${key.target_column}`} className="break-all">{selected.source_table}.{key.source_column} = {selected.table}.{key.target_column}</p>)}
        <p>자료형: {selected.data_type} · 값이나 연결된 행이 없으면 미확인 값으로 처리합니다.</p>
      </div>}
      <label className="flex flex-col gap-1.5 text-sm">새 필드 이름<input className={input} maxLength={200} value={draft.label} onChange={(event) => change({ label: event.target.value })} placeholder="사용자가 부를 이름" /></label>
      <label className="flex flex-col gap-1.5 text-sm">저장된 값의 의미<textarea className={`${input} min-h-24`} maxLength={2000} value={draft.semantic_description} onChange={(event) => change({ semantic_description: event.target.value })} placeholder="어떤 대상의 값인지, 전체 집계인지 개인별 값인지 설명하세요." /></label>
      {selected?.data_type === "number" && <label className="flex flex-col gap-1.5 text-sm">숫자의 단위<input className={input} maxLength={50} value={draft.unit ?? ""} onChange={(event) => change({ unit: event.target.value || null })} placeholder="예: count(횟수), KRW(원화)" /><span className="text-xs text-muted-foreground">설명 없이 단위 식별자만 입력하세요. 횟수는 count, 원화 금액은 KRW입니다.</span></label>}
      {selected?.data_type === "string" && <label className="flex flex-col gap-1.5 text-sm">허용할 값
        <select className={input} value={draft.value_domain ?? ""} onChange={(event) => change({ value_domain: event.target.value || null, allowed_operators: draft.allowed_operators.filter((op) => !event.target.value || ["=", "!=", "in", "not_in"].includes(op)) })}>
          <option value="">자유로운 문자열</option>{Object.entries(domains).map(([id, domain]) => <option key={id} value={id}>등록된 값 목록: {domain.label}</option>)}
        </select><span className="text-xs text-muted-foreground">값 목록을 고르면 그 목록에 등록된 값만 허용합니다.</span>
      </label>}
      {selected && <fieldset><legend className="mb-2 text-sm">새 필드에서 허용할 비교</legend><div className="settings-operator-list">{selected.allowed_operators.filter((op) => !draft.value_domain || ["=", "!=", "in", "not_in"].includes(op)).map((op) => <label key={op}><input type="checkbox" checked={draft.allowed_operators.includes(op)} onChange={(event) => change({ allowed_operators: event.target.checked ? [...draft.allowed_operators, op] : draft.allowed_operators.filter((item) => item !== op) })} />{operators[op] ?? op}</label>)}</div></fieldset>}
      <label className="flex flex-col gap-1.5 text-sm">값이 없는 고객의 ‘아님’ 조건 처리<select className={input} value={draft.negative_null_policy} onChange={(event) => change({ negative_null_policy: event.target.value as NewField["negative_null_policy"] })}><option value="exclude_unknown">결과에서 제외</option><option value="include_unknown">결과에 포함</option></select></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={`${button} bg-primary text-primary-foreground`} onClick={() => {
        const problem = connectionError(draft, selected);
        if (problem) { setError(problem); return; }
        onChange(replaceChange(pending, draft, (field) => field.binding_id === draft.binding_id)); setOpen(false);
      }}>변경 목록에 추가</button><button type="button" className={button} onClick={() => setOpen(false)}>입력 닫기</button></div>
    </div>}
  </div>;
}
