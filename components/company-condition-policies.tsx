"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { newPolicyNameError, type PolicyCard } from "@/lib/policy-settings";
import {
  blankCondition, blankGroup, comparisonLabels, conditionError, conditionSummary, selectCondition, unitLabel,
  type ConditionGroup, type ConditionOptions, type ConditionPolicyCreate, type ConditionPolicyEdit, type PolicyCondition,
} from "@/lib/company-policy-conditions";

const input = "settings-input min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40";

function ConditionRow({ node, menu, scope, depth, onChange, onRemove }: {
  node: PolicyCondition; menu: ConditionOptions; scope: string; depth: number;
  onChange: (node: PolicyCondition) => void; onRemove: () => void;
}) {
  if (node.kind === "group") return <div className="space-y-2">
    <div className="flex justify-end"><button type="button" className={button} onClick={onRemove}><Trash2 size={13} />묶음 삭제</button></div>
    <ConditionGroupEditor group={node} menu={menu} scope={scope} depth={depth} onChange={onChange} />
  </div>;
  const subject = scope === menu.subject_source;
  const selected = node.kind === "field" ? `field:${node.field_id}` : node.kind === "metric" ? `metric:${node.metric_id}` : `event:${node.source_id}`;
  const field = node.kind === "field" ? menu.fields.find((item) => item.id === node.field_id) : undefined;
  const metric = node.kind === "metric" ? menu.metrics.find((item) => item.id === node.metric_id) : undefined;
  const operators = field?.operators ?? metric?.operators ?? [];
  return <div className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
    <div className="flex items-start gap-2">
      <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">항목
        <select aria-label="조건 항목" className={input} value={selected === "field:" ? "" : selected}
          onChange={(event) => onChange(selectCondition(event.target.value, menu))}>
          <option value="" disabled>항목을 선택하세요</option>
          <optgroup label={subject ? "고객 정보" : "같은 이력의 필드"}>{menu.fields.filter((item) => item.source_id === scope).map((item) =>
            <option key={item.id} value={`field:${item.id}`}>{item.label}</option>)}</optgroup>
          {subject && <><optgroup label="기간별 집계">{menu.metrics.map((item) => <option key={item.id} value={`metric:${item.id}`}>{item.label}</option>)}</optgroup>
            <optgroup label="이력 있음·없음">{menu.events.map((item) => <option key={item.id} value={`event:${item.id}`}>{item.label} 이력</option>)}</optgroup></>}
        </select>
      </label>
      <button type="button" aria-label="조건 삭제" className={`${button} mt-5 shrink-0`} onClick={onRemove}><Trash2 size={15} /></button>
    </div>
    {node.kind !== "event" && (field || metric) && <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <label className="space-y-1 text-xs text-muted-foreground">비교
        <select aria-label="조건 비교" className={input} value={node.operator} onChange={(event) => onChange({ ...node, operator: event.target.value })}>
          {operators.map((operator) => <option key={operator} value={operator}>{comparisonLabels[operator]}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">값{node.unit && ` (${unitLabel(node.unit)})`}
        {field?.kind === "enum" ? <select aria-label="조건 값" className={input} value={String(node.value)} onChange={(event) => onChange({ ...node, value: event.target.value })}>
          <option value="" disabled>값을 선택하세요</option>{field.choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select> : field?.kind === "boolean" && node.kind === "field" ? <select aria-label="조건 값" className={input} value={String(node.value)} onChange={(event) => onChange({ ...node, value: event.target.value === "true" })}>
          <option value="true">참</option><option value="false">거짓</option>
        </select> : <input aria-label="조건 값" className={input} value={String(node.value)} maxLength={field?.kind === "string" ? 200 : 28}
          inputMode={field?.kind === "number" || metric ? "decimal" : "text"} onChange={(event) => onChange({ ...node, value: event.target.value })} />}
      </label>
    </div>}
    {(node.kind === "metric" || node.kind === "event") && <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">최근 <input aria-label="조회 기간(일)" className={`${input} max-w-24`} type="number" min={1} max={36500} step={1}
        value={node.days || ""} onChange={(event) => onChange({ ...node, days: Number(event.target.value) })} />일</label>
      {node.kind === "event" && <select aria-label="이력 유무" className={`${input} max-w-40`} value={node.mode}
        onChange={(event) => onChange({ ...node, mode: event.target.value === "absent" ? "absent" : "exists" })}>
        <option value="exists">이력 있음</option><option value="absent">이력 없음</option>
      </select>}
    </div>}
    {node.kind === "event" && <div className="space-y-3">
      {node.where ? <>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">아래 조건을 같은 이력 한 건에서 확인합니다.</p>
          <button type="button" className={button} onClick={() => onChange({ ...node, where: null })}>이력의 필드 조건 삭제</button></div>
        <ConditionGroupEditor group={node.where} menu={menu} scope={node.source_id} depth={depth + 1} onChange={(where) => onChange({ ...node, where })} />
      </> : <button type="button" className={button} disabled={depth >= 4 || !menu.fields.some((item) => item.source_id === node.source_id)}
        onClick={() => onChange({ ...node, where: blankGroup() })}><Plus size={13} />이력의 필드 조건 추가</button>}
    </div>}
  </div>;
}

function ConditionGroupEditor({ group, menu, scope, depth = 1, onChange }: {
  group: ConditionGroup; menu: ConditionOptions; scope: string; depth?: number; onChange: (group: ConditionGroup) => void;
}) {
  return <fieldset className="min-w-0 space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 sm:p-4">
    <legend className="px-1 text-xs font-medium">조건 묶음</legend>
    <label className="flex flex-wrap items-center gap-2 text-sm font-medium">이 묶음은
      <select aria-label="묶음 충족 방식" className={`${input} sm:max-w-64`} value={group.mode}
        onChange={(event) => onChange({ ...group, mode: event.target.value === "any" ? "any" : "all" })}>
        <option value="all">모두 충족 (AND)</option><option value="any">하나 이상 충족 (OR)</option>
      </select>
    </label>
    {group.children.map((child, index) => <ConditionRow key={index} node={child} menu={menu} scope={scope} depth={depth + 1}
      onChange={(next) => onChange({ ...group, children: group.children.map((item, i) => i === index ? next : item) })}
      onRemove={() => onChange({ ...group, children: group.children.filter((_, i) => i !== index) })} />)}
    {!group.children.length && <p className="text-xs text-destructive">조건을 추가해 주세요.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={group.children.length >= 20} onClick={() => onChange({ ...group, children: [...group.children, blankCondition()] })}><Plus size={13} />조건 추가</button>
      <button type="button" className={button} disabled={group.children.length >= 20 || depth >= 4} onClick={() => onChange({ ...group, children: [...group.children, blankGroup()] })}><Plus size={13} />묶음 추가</button>
    </div>
  </fieldset>;
}

export function CompanyConditionPolicies({ menu, cards, creations, changes, onCreationsChange, onChange }: {
  menu: ConditionOptions; cards: PolicyCard[]; creations: ConditionPolicyCreate[]; changes: ConditionPolicyEdit[];
  onCreationsChange: (items: ConditionPolicyCreate[]) => void; onChange: (items: ConditionPolicyEdit[]) => void;
}) {
  function editor(condition: ConditionGroup, update: (condition: ConditionGroup) => void) {
    const error = conditionError(condition, menu);
    return <div className="space-y-3"><ConditionGroupEditor group={condition} menu={menu} scope={menu.subject_source} onChange={update} />
      {error && <p className="text-xs text-destructive" role="status">{error}</p>}
      {!error && <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{conditionSummary(condition, menu)}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">값이 없는 필드는 비교 대상에서 제외합니다. 기간은 조회 시점부터 최근 N일입니다. 이력이 없으면 횟수와 합계는 0이며, 평균·최솟값·최댓값은 비교 대상에서 제외합니다.</p>
    </div>;
  }
  return <section aria-label="조건으로 회사 정책 만들기" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div><h3 className="text-sm font-semibold">원하는 조건으로 새 정책 만들기</h3><p className="mt-1 text-xs text-muted-foreground">필드·비교·기간을 고르고 조건을 AND/OR로 묶어 주세요.</p></div>
      <button type="button" disabled={creations.length >= 20} className={`${button} bg-primary px-4 text-primary-foreground hover:bg-primary/90`}
        onClick={() => onCreationsChange([...creations, { name: "", condition: blankGroup() }])}><Plus size={16} />정책 추가</button>
    </div>
    {creations.map((item, index) => {
      const update = (next: ConditionPolicyCreate) => onCreationsChange(creations.map((other, i) => i === index ? next : other));
      const nameError = newPolicyNameError(item.name, cards, creations.filter((_, i) => i !== index));
      return <section key={index} aria-label={`새 조건 정책 ${index + 1}`} className="space-y-4 rounded-xl border border-primary/40 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">새 정책 {index + 1}</h3><button type="button" className={button}
          onClick={() => onCreationsChange(creations.filter((_, i) => i !== index))}><Trash2 size={13} />추가 취소</button></div>
        <label className="block space-y-2 text-sm font-medium">정책 이름<input className={input} value={item.name} maxLength={50} placeholder="예: 주말 관심 고객"
          aria-invalid={!!nameError} onChange={(event) => update({ ...item, name: event.target.value })} /></label>
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        {editor(item.condition, (condition) => update({ ...item, condition }))}
      </section>;
    })}
    {cards.filter((card) => card.condition).map((card) => {
      const original = card.condition!;
      const changed = changes.find((item) => item.id === card.id);
      return <details key={card.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <summary className="cursor-pointer"><span className="font-semibold">{card.label}</span>{changed && <span className="ml-2 text-xs text-primary">변경 중</span>}
          <p className="mt-2 text-sm text-muted-foreground">{conditionSummary(changed?.condition ?? original, menu)}</p></summary>
        <div className="mt-4 space-y-3">{editor(changed?.condition ?? original, (condition) => {
          const rest = changes.filter((item) => item.id !== card.id);
          onChange(JSON.stringify(condition) === JSON.stringify(original) ? rest : [...rest, { id: card.id, condition }]);
        })}
          {changed && <button type="button" className={button} onClick={() => onChange(changes.filter((item) => item.id !== card.id))}><RotateCcw size={13} />이 정책의 변경 취소</button>}
        </div>
      </details>;
    })}
  </section>;
}
