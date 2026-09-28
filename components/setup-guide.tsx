"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";

import { JsonFileDialog } from "@/components/json-file-dialog";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  applySetupValues,
  isUsableValue,
  SETUP_INPUTS,
  SETUP_STEPS,
  SETUP_TROUBLESHOOTING,
  type SetupStep,
  type SetupValueId,
  type SetupValues,
} from "@/lib/setup-guide";

/**
 * 명령에 직접 적을 값 하나를 설명하는 칸.
 *
 * 자리 표시(`<고객표>`)를 제목 옆에 같은 글자로 두는 것이 이 칸의 일이다 — 다음 단계 명령에
 * 그 글자가 그대로 있으므로, 읽는 사람이 "이 자리 이야기구나" 를 옮겨 적지 않아도 된다.
 */
function DecisionCard({
  decision,
}: {
  decision: (typeof SETUP_STEPS)[number]["decisions"][number];
}) {
  return (
    <li className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
          {decision.placeholder}
        </code>
        <span className="text-sm font-semibold text-foreground">
          {decision.title}
        </span>
      </div>
      <p className="mt-1 text-sm text-foreground">{decision.plain}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {decision.pick.map((line) => (
          <li key={line} className="flex gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden>·</span>
            <span className="min-w-0 flex-1">{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
        {decision.example}
      </p>
    </li>
  );
}

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
  values,
  onOpenFile,
}: {
  step: SetupStep;
  index: number;
  values: SetupValues;
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
              <CommandRow key={command} command={applySetupValues(command, values)} />
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
        {step.decisions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {step.decisions.map((decision) => (
              <DecisionCard key={decision.placeholder} decision={decision} />
            ))}
          </ul>
        )}

      </div>
    </li>
  );
}

export function SetupGuide() {
  const [values, setValues] = useState<SetupValues>({});
  // 눌러서 열어 본 선언 파일. 팝업은 읽기 전용이다.
  const [openFile, setOpenFile] = useState<string | null>(null);
  const inputId = useId();

  const setValue = (id: SetupValueId, value: string) =>
    setValues((current) => ({ ...current, [id]: value }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <p className="text-xs font-medium text-foreground">
          아래 세 가지를 적으면 이 화면의 명령에 그대로 들어갑니다
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {SETUP_INPUTS.map((input) => {
            const value = values[input.id] ?? "";
            const typed = value.trim().length > 0;
            const usable = isUsableValue(input.id, value);
            return (
              <div key={input.id} className="flex min-w-0 flex-col gap-1">
                <label
                  htmlFor={`${inputId}-${input.id}`}
                  className="flex flex-wrap items-baseline gap-1.5 text-xs font-medium text-foreground"
                >
                  {input.label}
                  <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[10px] text-primary">
                    {input.placeholder}
                  </code>
                </label>
                <input
                  id={`${inputId}-${input.id}`}
                  value={value}
                  onChange={(event) => setValue(input.id, event.target.value)}
                  placeholder={input.example}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={typed && !usable}
                  className={`w-52 rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    typed && !usable ? "border-destructive" : "border-border"
                  }`}
                />
                {typed && !usable && (
                  <span className="text-[11px] text-destructive">
                    {input.shape}만 씁니다. 그 전까지는 자리 표시가 남습니다.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {SETUP_STEPS.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            values={values}
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
