"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { eventError, type EventConnection, type NewEvent } from "@/lib/profile-declarations";
import type { SetupSnapshot } from "@/lib/profile-setup";

const input = "settings-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "settings-button rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
const clocks: Record<string, string> = { date: "날짜", timestamp: "날짜·시각" };

const blank = (timezone: string): NewEvent => ({ binding_id: "", id: "", label: "", aliases: [], semantic_description: "", timezone });

function optionLabel(option: EventConnection, subject: string): string {
  return option.kind === "subject_column"
    ? `${subject} 표의 날짜 하나 (${subject}마다 한 번)`
    : `${option.link_column}로 ${subject}와 연결${option.foreign_key ? " · DB 외래 키" : ""}`;
}

export function ProfileSetupEvents({ snapshot, pending, onChange }: {
  snapshot: SetupSnapshot; pending: NewEvent[]; onChange: (events: NewEvent[]) => void;
}) {
  const timezone = snapshot.event_timezone ?? "Asia/Seoul";
  const [draft, setDraft] = useState<NewEvent | null>(null);
  const [table, setTable] = useState("");
  const [error, setError] = useState("");
  const subject = snapshot.subject.label || "고객";
  const options = snapshot.event_connections ?? [];
  const tables = [...new Set(options.map((option) => option.table))];
  const tableOptions = options.filter((option) => option.table === table);
  const change = (patch: Partial<NewEvent>) => { if (draft) setDraft({ ...draft, ...patch }); setError(""); };
  const events = Object.entries(snapshot.events ?? {});

  return <div className="space-y-5">
    <div className="settings-section-intro"><CalendarClock size={23} aria-hidden /><div><h2>사건</h2>
      <p>{subject}에게 일어난 일을 기록한 표를 사건으로 등록합니다. 사건이 있어야 “최근 30일 안에”, “입사한 지 5년” 같은 기간 조건과 횟수·합계 지표를 쓸 수 있습니다.</p></div></div>

    <section className="space-y-2" aria-label="등록된 사건">
      <h3 className="text-sm font-semibold">등록된 사건 {events.length}개</h3>
      {events.length === 0 && <p className="text-sm text-muted-foreground">아직 등록된 사건이 없습니다.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {events.map(([id, event]) => <div key={id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">{event.label} <span className="text-xs font-normal text-muted-foreground">({id})</span></p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{event.table} · 시각 {event.time_column}({clocks[event.clock] ?? event.clock}) · {event.kind === "subject_column" ? `${subject}마다 한 번` : `${subject}마다 여러 번`}{event.timezone ? ` · ${event.timezone}` : ""}</p>
        </div>)}
      </div>
    </section>

    {pending.map((item) => <div key={item.binding_id} className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-medium">{item.label} ({item.id}) · {options.find((option) => option.id === item.binding_id)?.table}</p>
      <p className="text-xs text-muted-foreground">저장 대기 중 · 저장하면 이 사건의 다른 컬럼이 ‘필드와 값’에 설정할 필드로 나타납니다.</p>
      <div className="flex gap-2"><button type="button" className={button} onClick={() => { setDraft(item); setTable(options.find((option) => option.id === item.binding_id)?.table ?? ""); }}>수정</button>
        <button type="button" className={button} onClick={() => onChange(pending.filter((other) => other !== item))}>추가 취소</button></div>
    </div>)}

    {!draft ? <button type="button" className={button} disabled={!options.length} onClick={() => { setDraft(blank(timezone)); setTable(""); setError(""); }}>사건 추가</button>
      : <div className="space-y-4 rounded-xl border border-border p-4" aria-label="새 사건">
        <div><h3 className="font-semibold">새 사건</h3><p className="mt-1 text-xs text-muted-foreground">기본 키가 있는 표만 보입니다. {subject} 키와 자료형이 같은 컬럼 중에서 어느 컬럼이 {subject}를 가리키는지 직접 고르세요.</p></div>
        <label className="flex flex-col gap-1.5 text-sm">사건 기록 표
          <select className={input} value={table} onChange={(event) => { setTable(event.target.value); change({ binding_id: "" }); }}>
            <option value="">선택하세요</option>{tables.map((name) => <option key={name} value={name}>{name}{name === snapshot.subject.table ? ` (${subject} 표)` : ""}</option>)}
          </select>
        </label>
        {table && <label className="flex flex-col gap-1.5 text-sm">{subject} 연결과 사건 시각
          <select className={input} value={draft.binding_id} onChange={(event) => change({ binding_id: event.target.value })}>
            <option value="">선택하세요</option>{tableOptions.map((option) => <option key={option.id} value={option.id}>시각 {option.time_column}({clocks[option.clock]}) · {optionLabel(option, subject)}</option>)}
          </select>
        </label>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">사건 이름<input className={input} value={draft.label} placeholder="예: 초과 근무" onChange={(event) => change({ label: event.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-sm">사건 ID<input className={`${input} font-mono`} value={draft.id} placeholder="예: overtime" onChange={(event) => change({ id: event.target.value.trim() })} />
            <span className="text-xs text-muted-foreground">영문 소문자·숫자·_ — 저장 후에는 바꿀 수 없습니다.</span></label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">다른 이름(쉼표로 구분, 선택)
          <input className={input} value={draft.aliases.join(", ")} placeholder="예: 초과근무, 연장 근무" onChange={(event) => change({ aliases: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">무엇을 기록하나요
          <input className={input} value={draft.semantic_description} placeholder="예: 근무일 하루에 한 건씩 남는 초과 근무 기록." onChange={(event) => change({ semantic_description: event.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">기록 시간대
          <input className={`${input} font-mono`} value={draft.timezone} onChange={(event) => change({ timezone: event.target.value.trim() })} />
          <span className="text-xs text-muted-foreground">DB에 날짜가 어느 시간대로 저장됐는지(IANA 이름)입니다.</span>
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={`${button} bg-primary text-primary-foreground`} onClick={() => {
            const others = pending.filter((item) => item.binding_id !== draft.binding_id);
            const problem = eventError(draft, snapshot, [...others, draft]);
            if (problem) { setError(problem); return; }
            onChange([...others, draft]); setDraft(null);
          }}>변경 목록에 추가</button>
          <button type="button" className={button} onClick={() => { setDraft(null); setError(""); }}>닫기</button>
        </div>
      </div>}
    {!options.length && <p className="text-xs text-muted-foreground">새로 등록할 수 있는 표·날짜 컬럼이 없습니다(기본 키와 날짜 컬럼이 있는 표만 사건이 될 수 있습니다).</p>}
  </div>;
}
