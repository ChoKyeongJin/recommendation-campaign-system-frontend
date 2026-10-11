"use client";

import { ChevronDown, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  changePolicy, newPolicy, newPolicyNameError, policyInputError, policyValue, policyValueLabel,
  type NewPolicy, type PolicyCard, type PolicyChange, type PolicySetting, type PolicyValue,
} from "@/lib/policy-settings";

const input = "settings-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60";

function SettingInput({ setting, value, onChange }: {
  setting: PolicySetting; value: PolicyValue; onChange: (value: PolicyValue) => void;
}) {
  const error = policyInputError(setting, value);
  return <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
    {setting.label}
    {setting.kind === "toggle" ? <select className={input} value={String(value)} disabled={setting.disabled}
      onChange={(event) => onChange(event.target.value === "true")}>
      <option value="true">사용</option><option value="false">사용 안 함</option>
    </select> : setting.kind === "select" ? <select className={input} value={String(value)} disabled={setting.disabled}
      onChange={(event) => onChange(event.target.value)}>
      {setting.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : <span className="flex items-center gap-2">
      <input className={input} type="text" maxLength={28} inputMode={setting.kind === "integer" ? "numeric" : "decimal"}
        value={String(value)} disabled={setting.disabled} aria-invalid={!!error} onChange={(event) => {
          const raw = event.target.value;
          onChange(setting.kind === "integer" && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : raw);
        }} />
      <span className="shrink-0 text-muted-foreground">{setting.unit}</span>
    </span>}
    {setting.hint && <span className="text-xs font-normal leading-relaxed text-muted-foreground">{setting.hint}</span>}
    {error && <span className="text-xs font-normal text-destructive" role="alert">{error}</span>}
  </label>;
}

export function PolicyChangePreview({ cards, changes, creations = [] }: { cards: PolicyCard[]; changes: PolicyChange[]; creations?: NewPolicy[] }) {
  if (!changes.length && !creations.length) return null;
  return <section className="rounded-xl border border-primary/25 bg-primary/5 p-5" aria-label="정책 변경 내용">
    <h3 className="text-sm font-semibold">이렇게 바뀝니다</h3>
    <ul className="mt-3 space-y-2 text-sm">
      {creations.map((creation, index) => {
        const template = cards.find((card) => card.id === creation.template_id);
        return <li key={`new-${index}`} className="space-y-1"><p><strong>{creation.name || "새 정책"}</strong> 추가</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{creation.settings.map((item) => {
            const setting = template?.settings.find((setting) => setting.id === item.id);
            return setting ? `${setting.label}: ${policyValueLabel(setting, item.value)}` : "";
          }).filter(Boolean).join(" · ")}</p>
        </li>;
      })}
      {changes.flatMap((change) => {
        const card = cards.find((item) => item.id === change.id);
        return change.settings.map((changed) => {
          const setting = card?.settings.find((item) => item.id === changed.id);
          return setting && <li key={`${change.id}:${changed.id}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>{card?.label} · {setting.label}</span>
            <span className="text-muted-foreground">{policyValueLabel(setting, setting.value)}</span>
            <span aria-label="에서">→</span><strong>{policyValueLabel(setting, changed.value)}</strong>
          </li>;
        });
      })}
    </ul>
  </section>;
}

export function PolicySettingsEditor({ cards, changes, onChange, creations, onCreationsChange }: {
  cards: PolicyCard[]; changes: PolicyChange[]; onChange: (changes: PolicyChange[]) => void;
  creations: NewPolicy[]; onCreationsChange: (creations: NewPolicy[]) => void;
}) {
  if (!cards.length) return <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">편집할 회사 정책을 불러오지 못했습니다. 설정 서버의 정책 연결을 확인해 주세요.</p>;
  const templates = cards.filter((card) => card.creatable);
  function updateCreation(index: number, next: NewPolicy) {
    onCreationsChange(creations.map((creation, i) => i === index ? next : creation));
  }
  return <div className="space-y-6">
    <div className="settings-section-intro"><SlidersHorizontal size={23} aria-hidden /><div>
      <h2>우리 회사의 고객 선정 기준</h2>
      <p>정책을 추가하거나 기존 기준을 수정하세요. 변경 내용은 저장하고 적용한 뒤 반영됩니다.</p>
    </div></div>
    {!!templates.length && <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">지원하는 기준을 선택하고 이름과 숫자만 입력하면 새 정책을 만들 수 있습니다.</p>
      <button type="button" disabled={creations.length >= 20}
        className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
        onClick={() => onCreationsChange([...creations, newPolicy(templates[0])])}><Plus size={16} aria-hidden />정책 추가</button>
    </div>}
    {creations.map((creation, index) => {
      const template = templates.find((card) => card.id === creation.template_id);
      const nameError = newPolicyNameError(creation.name, cards, creations.filter((_, i) => i !== index));
      return <section key={index} aria-label={`새 정책 ${index + 1}`} className="space-y-5 rounded-xl border border-primary/40 bg-card p-5">
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">새 정책 {index + 1}</h3>
          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            onClick={() => onCreationsChange(creations.filter((_, i) => i !== index))}><Trash2 size={14} aria-hidden />추가 취소</button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">정책 이름
            <input className={input} value={creation.name} maxLength={50} placeholder="예: 패밀리 고객" aria-invalid={!!nameError}
              onChange={(event) => updateCreation(index, { ...creation, name: event.target.value })} />
            <span className="text-xs font-normal text-muted-foreground">저장 후 이 이름으로 고객을 요청할 수 있습니다.</span>
            {nameError && <span role="alert" className="text-xs font-normal text-destructive">{nameError}</span>}
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">기준 선택
            <select className={input} value={creation.template_id} onChange={(event) => {
              const selected = templates.find((card) => card.id === event.target.value);
              if (selected) updateCreation(index, newPolicy(selected, creation.name));
            }}>{templates.map((card) => <option key={card.id} value={card.id}>{card.label} 기준으로 시작</option>)}</select>
            <span className="text-xs font-normal text-muted-foreground">선택한 기준의 계산 방식을 사용합니다. 아래 숫자는 새 정책에만 적용됩니다.</span>
          </label>
        </div>
        {template && <>
          <div className="grid gap-4 sm:grid-cols-2">{template.settings.map((setting) => <SettingInput key={setting.id} setting={setting}
            value={creation.settings.find((item) => item.id === setting.id)?.value ?? setting.value}
            onChange={(value) => updateCreation(index, { ...creation, settings: creation.settings.map((item) => item.id === setting.id ? { ...item, value } : item) })} />)}</div>
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">{template.notes.map((note) => <p key={note}>{note}</p>)}</div>
        </>}
      </section>;
    })}
    {[...new Set(cards.map((card) => card.group))].map((group) => <section key={group} className="space-y-3" aria-label={group}>
      <h3 className="text-sm font-semibold text-muted-foreground">{group}</h3>
      <div className="grid items-start gap-3 xl:grid-cols-2">
        {cards.filter((card) => card.group === group).map((card) => {
          const changed = changes.some((item) => item.id === card.id);
          return <details key={card.id} className="group rounded-xl border border-border bg-card open:border-primary/40">
            <summary className="flex cursor-pointer list-none items-start gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-semibold">{card.label}
                {changed && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">변경 중</span>}
              </span><span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">{card.summary}</span></span>
              <ChevronDown size={18} className="mt-1 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-4 border-t border-border p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {card.settings.map((setting) => <SettingInput key={setting.id} setting={setting} value={policyValue(card, setting, changes)}
                  onChange={(value) => onChange(changePolicy(changes, card, setting, value))} />)}
              </div>
              {!!card.notes.length && <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">{card.notes.map((note) => <p key={note}>{note}</p>)}</div>}
              {changed && <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onChange(changes.filter((item) => item.id !== card.id))}><RotateCcw size={13} aria-hidden />이 정책의 변경 취소</button>}
            </div>
          </details>;
        })}
      </div>
    </section>)}
  </div>;
}
