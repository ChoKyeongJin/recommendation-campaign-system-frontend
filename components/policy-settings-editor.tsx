"use client";

import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  changePolicy, policyInputError, policyValue, policyValueLabel,
  type PolicyCard, type PolicyChange, type PolicySetting, type PolicyValue,
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

export function PolicyChangePreview({ cards, changes }: { cards: PolicyCard[]; changes: PolicyChange[] }) {
  if (!changes.length) return null;
  return <section className="rounded-xl border border-primary/25 bg-primary/5 p-5" aria-label="정책 변경 내용">
    <h3 className="text-sm font-semibold">이렇게 바뀝니다</h3>
    <ul className="mt-3 space-y-2 text-sm">
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

export function PolicySettingsEditor({ cards, changes, onChange }: {
  cards: PolicyCard[]; changes: PolicyChange[]; onChange: (changes: PolicyChange[]) => void;
}) {
  if (!cards.length) return <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">편집할 회사 정책을 불러오지 못했습니다. 설정 서버의 정책 연결을 확인해 주세요.</p>;
  return <div className="space-y-6">
    <div className="settings-section-intro"><SlidersHorizontal size={23} aria-hidden /><div>
      <h2>우리 회사의 고객 선정 기준</h2>
      <p>바꿀 정책을 펼쳐 숫자나 선택 항목을 수정하세요. 기존 기준은 저장하기 전까지 유지됩니다.</p>
    </div></div>
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
