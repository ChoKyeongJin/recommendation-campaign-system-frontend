"use client";

import { useEffect, useId, useState } from "react";
import { Check, ChevronDown, Copy, Wrench } from "lucide-react";

import { copyTextToClipboard } from "@/lib/clipboard";
import {
  applyProfileName,
  EXAMPLE_PROFILE_NAME,
  isUsableProfileName,
  SETUP_GUIDE_STORAGE_KEY,
  SETUP_STEPS,
  SETUP_TROUBLESHOOTING,
  type SetupStep,
} from "@/lib/setup-guide";

/**
 * 화면 맨 위의 "처음 세팅하는 법" 카드.
 *
 * 처음 온 사람에게는 펼쳐진 채로 보이고, 한 번 접으면 그 선택을 기억한다 — 매일 타겟을
 * 뽑는 사람에게 세팅 안내는 항상 펼쳐져 있을 내용이 아니다.
 *
 * 순서와 문구는 `lib/setup-guide.ts` 가 소유한다. 이 파일은 그리기만 한다.
 */

function CommandRow({ command }: { command: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const handleCopy = async () => {
    const copied = await copyTextToClipboard(command);
    setCopyStatus(copied ? "copied" : "failed");
    setTimeout(() => setCopyStatus("idle"), 1500);
  };

  const copied = copyStatus === "copied";
  const label = copied
    ? "복사됨"
    : copyStatus === "failed"
      ? "복사 실패"
      : "명령 복사";

  return (
    <div className="flex items-stretch gap-1.5">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs leading-relaxed text-foreground">
        {command}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        aria-live="polite"
        title={label}
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
        <span className="hidden sm:inline">{copied ? "복사됨" : "복사"}</span>
      </button>
    </div>
  );
}

function StepCard({
  step,
  index,
  profileName,
}: {
  step: SetupStep;
  index: number;
  profileName: string;
}) {
  const automatic = step.kind === "machine";
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          automatic
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground"
        }`}
        aria-hidden
      >
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {step.title}
          </h3>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              automatic
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary/10 text-primary"
            }`}
          >
            {automatic ? "명령만 실행" : "사람이 판단"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{step.lead}</p>

        {step.commands.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {step.commands.map((command) => (
              <CommandRow
                key={command}
                command={applyProfileName(command, profileName)}
              />
            ))}
          </div>
        )}

        {step.fillIns.length > 0 && (
          <ol className="flex flex-col gap-2">
            {step.fillIns.map((fillIn, position) => (
              <li
                key={fillIn.where}
                className="rounded-md border border-border bg-background/60 px-3 py-2"
              >
                <p className="text-xs font-semibold text-foreground">
                  {position + 1}. {fillIn.where}
                </p>
                <p className="mt-1 text-xs text-foreground">{fillIn.what}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fillIn.detail}
                </p>
              </li>
            ))}
          </ol>
        )}

        {step.notes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {step.notes.map((note) => (
              <li
                key={note}
                className="flex gap-1.5 text-xs text-muted-foreground"
              >
                <span aria-hidden>·</span>
                <span className="min-w-0 flex-1">{note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function SetupGuide() {
  // 처음 방문은 펼친 상태다. 저장된 선택은 브라우저에만 있으므로 그린 뒤에 읽는다.
  const [open, setOpen] = useState(true);
  const [profileName, setProfileName] = useState("");
  const bodyId = useId();
  const inputId = useId();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SETUP_GUIDE_STORAGE_KEY) === "1") {
        setOpen(false);
      }
    } catch {
      // 저장소를 막아 둔 브라우저에서는 매번 펼친 상태로 둔다.
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(SETUP_GUIDE_STORAGE_KEY, next ? "0" : "1");
    } catch {
      // 기억하지 못해도 이번 화면에서는 접힌다.
    }
  };

  const nameIsUsable = isUsableProfileName(profileName);
  const nameWasTyped = profileName.trim().length > 0;

  return (
    <section className="rounded-xl border border-border bg-card/60 text-card-foreground">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-sm font-semibold text-foreground">
          처음 세팅하는 법
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          새 DB 를 붙이는 5단계
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {open ? "접기" : "펼치기"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div id={bodyId} className="flex flex-col gap-5 px-4 pb-4">
          <p className="text-sm text-muted-foreground">
            1 · 3 · 5단계는 적어 둔 명령을 그대로 실행하면 됩니다. 손으로 적는
            곳은 4단계 하나입니다.
          </p>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={inputId}
              className="text-xs font-medium text-foreground"
            >
              프로필 이름
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={inputId}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder={EXAMPLE_PROFILE_NAME}
                spellCheck={false}
                autoComplete="off"
                className="w-56 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground">
                {nameWasTyped && !nameIsUsable
                  ? "영문·숫자·밑줄·붙임표만 씁니다. 그 전까지는 명령에 자리 표시가 남습니다."
                  : "적으면 아래 명령에 그대로 들어갑니다."}
              </span>
            </div>
          </div>

          <ol className="flex flex-col gap-5">
            {SETUP_STEPS.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                profileName={profileName}
              />
            ))}
          </ol>

          <div className="rounded-md bg-muted/60 px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">막히면</p>
            <ul className="mt-1 flex flex-col gap-1">
              {SETUP_TROUBLESHOOTING.map((line) => (
                <li
                  key={line}
                  className="flex gap-1.5 text-xs text-muted-foreground"
                >
                  <span aria-hidden>·</span>
                  <span className="min-w-0 flex-1">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
