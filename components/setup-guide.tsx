"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";

import { JsonFileDialog } from "@/components/json-file-dialog";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  applyProfileName,
  EXAMPLE_PROFILE_NAME,
  isUsableProfileName,
  SETUP_STEPS,
  SETUP_TROUBLESHOOTING,
  type SetupStep,
} from "@/lib/setup-guide";

/**
 * 「처음 세팅하는 법」 화면(`/admin/setup`)의 본문.
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
  onOpenFile,
}: {
  step: SetupStep;
  index: number;
  profileName: string;
  onOpenFile: (file: string) => void;
}) {
  const automatic = step.kind === "machine";
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card/60 px-4 py-4">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
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
          <h2 className="text-sm font-semibold text-foreground">
            {step.title}
          </h2>
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
                key={`${fillIn.file}:${fillIn.where}`}
                className="rounded-md border border-border bg-background/60 px-3 py-2"
              >
                <p className="text-xs font-semibold text-foreground">
                  {position + 1}.{" "}
                  <button
                    type="button"
                    onClick={() => onOpenFile(fillIn.file)}
                    title={`${fillIn.file} 열어 보기`}
                    className="cursor-pointer rounded font-mono text-primary underline decoration-dotted underline-offset-2 transition-colors hover:bg-primary/10 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {fillIn.file}
                  </button>{" "}
                  — {fillIn.where}
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
  const [profileName, setProfileName] = useState("");
  // 눌러서 열어 본 선언 파일. 팝업은 읽기 전용이다.
  const [openFile, setOpenFile] = useState<string | null>(null);
  const inputId = useId();

  const nameIsUsable = isUsableProfileName(profileName);
  const nameWasTyped = profileName.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <label htmlFor={inputId} className="text-xs font-medium text-foreground">
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

      <ol className="flex flex-col gap-3">
        {SETUP_STEPS.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            profileName={profileName}
            onOpenFile={setOpenFile}
          />
        ))}
      </ol>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">막히면</p>
        <ul className="mt-1.5 flex flex-col gap-1">
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

      <JsonFileDialog name={openFile} onClose={() => setOpenFile(null)} />
    </div>
  );
}
