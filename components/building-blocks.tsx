"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import {
  ABSENCE_SEQUENCE,
  ASSEMBLY_STEPS,
  BLOCK_GROUPS,
  edgesUpTo,
  EXAMPLE_SQL,
  EXAMPLE_SQL_NOTE,
  IF_WE_DID_IT_THE_OTHER_WAY,
  LAST_STEP,
  nodesUpTo,
  OTHER_EXAMPLES,
  SENTENCE_PARTS,
  TECHNICAL_NOTE,
  WHY_IT_MATTERS,
  type Branch,
} from "@/lib/building-blocks";

/**
 * 문장 하나가 블록으로 조립되는 과정을 단계로 넘겨 보는 그림.
 *
 * 트리와 문구는 `lib/building-blocks.ts` 가 소유한다. 이 파일은 그리기와 단계 넘김만 맡는다.
 */

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 500;
const BOX_W = 200;
const BOX_H = 58;
/** 한 단계를 보여 주는 시간. 읽고 넘어갈 만큼 둔다. */
const STEP_MS = 5200;

/** 가지 색 — 위에 띄운 문장의 색과 같아야 어느 말이 어느 가지가 됐는지 이어진다. */
const BRANCH_BOX: Record<Branch, string> = {
  root: "fill-primary/15 stroke-primary",
  left: "fill-emerald-500/10 stroke-emerald-500",
  right: "fill-sky-500/10 stroke-sky-500",
};

const BRANCH_TEXT: Record<Branch, string> = {
  root: "bg-primary/10 text-primary",
  left: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  right: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

export function BuildingBlocks() {
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setReducedMotion(true);
        setPlaying(false);
      }
    } catch {
      // matchMedia 가 없으면 그대로 넘긴다.
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setStep((current) => (current >= LAST_STEP ? 1 : current + 1)),
      STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [playing, step]);

  const go = useCallback((next: number) => {
    setPlaying(false);
    setStep(Math.min(LAST_STEP, Math.max(1, next)));
  }, []);

  const nodes = nodesUpTo(step);
  const edges = edgesUpTo(step);
  const current = ASSEMBLY_STEPS[step - 1];
  const showSql = step >= LAST_STEP;
  const boxH = showTechnical ? BOX_H + 14 : BOX_H;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
        {/* 원래 문장 — 조건이 되는 말에 가지 색을 입힌다 */}
        <div className="rounded-lg border border-border bg-background px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            사용자가 쓴 문장
          </p>
          <p className="mt-1 text-base font-semibold leading-relaxed text-foreground">
            {SENTENCE_PARTS.map((part, index) =>
              part.branch ? (
                <span
                  key={index}
                  className={`rounded px-1 py-0.5 ${BRANCH_TEXT[part.branch]}`}
                >
                  {part.text}
                </span>
              ) : (
                <span key={index} className="text-muted-foreground">
                  {part.text}
                </span>
              ),
            )}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            색칠한 두 말이 조건이 됩니다. 아래 그림에서 같은 색 가지로 이어집니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 1}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            이전
          </button>
          <button
            type="button"
            onClick={() => {
              if (step >= LAST_STEP) setStep(1);
              setPlaying((value) => !value);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            {playing ? "일시정지" : "자동으로 넘기기"}
          </button>
          <button
            type="button"
            onClick={() => go(step + 1)}
            disabled={step === LAST_STEP}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            다음
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {ASSEMBLY_STEPS.map((assemblyStep, index) => (
              <button
                key={assemblyStep.title}
                type="button"
                onClick={() => go(index + 1)}
                aria-label={`${index + 1}단계: ${assemblyStep.title}`}
                aria-current={step === index + 1}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  step === index + 1
                    ? "bg-primary"
                    : step > index + 1
                      ? "bg-primary/40"
                      : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {step}단계. {current.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{current.plain}</p>

          {step === 3 && (
            <ol className="mt-2.5 flex flex-col gap-1.5">
              {ABSENCE_SEQUENCE.map((item, index) => (
                <li key={item.text} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-700 dark:text-sky-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-foreground">
                    {item.text}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({item.blockName} 블록)
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {current.readback && (
            <p className="mt-2.5 rounded-md border-l-2 border-primary/50 bg-background px-2.5 py-2 text-sm text-foreground">
              <span className="font-medium text-muted-foreground">
                지금까지 조립한 것을 말로 읽으면{" "}
              </span>
              “{current.readback}”
            </p>
          )}
        </div>

        {step === 1 && (
          <div className="flex flex-wrap gap-2 px-1 py-8">
            {SENTENCE_PARTS.filter((part) => part.branch).map((part) => (
              <span
                key={part.text}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${BRANCH_TEXT[part.branch as Branch]}`}
              >
                {part.text}
              </span>
            ))}
          </div>
        )}

        {step > 1 && (
          <>
            <div className="flex items-center justify-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showTechnical}
                  onChange={(event) => setShowTechnical(event.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                기술 이름도 보기
              </label>
            </div>
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                className="h-auto w-full min-w-[760px]"
                role="img"
                aria-label={`${step}단계 조립 상태. 블록 ${nodes.length}개.`}
              >
                {edges.map((edge) => (
                  <line
                    key={`${edge.from.id}-${edge.to.id}`}
                    x1={edge.from.x}
                    y1={edge.from.y + boxH / 2}
                    x2={edge.to.x}
                    y2={edge.to.y - boxH / 2}
                    className="stroke-border"
                    strokeWidth={2}
                  />
                ))}
                {nodes.map((node) => {
                  const justAdded = node.step === step;
                  return (
                    <g key={node.id}>
                      <rect
                        x={node.x - BOX_W / 2}
                        y={node.y - boxH / 2}
                        width={BOX_W}
                        height={boxH}
                        rx={10}
                        className={BRANCH_BOX[node.branch]}
                        strokeWidth={justAdded ? 2.5 : 1.5}
                      />
                      <text
                        x={node.x}
                        y={node.y - (showTechnical ? 8 : 3)}
                        textAnchor="middle"
                        className="fill-foreground text-[15px] font-semibold"
                      >
                        {node.meaning}
                      </text>
                      <text
                        x={node.x}
                        y={node.y + (showTechnical ? 10 : 16)}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[12px]"
                      >
                        {node.blockName} 블록
                      </text>
                      {showTechnical && (
                        <text
                          x={node.x}
                          y={node.y + 26}
                          textAnchor="middle"
                          className="fill-muted-foreground/70 font-mono text-[10px]"
                        >
                          {node.technical}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </>
        )}

        {showSql && (
          <div className="flex flex-col gap-1.5">
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
              {EXAMPLE_SQL}
            </pre>
            <p className="text-xs text-muted-foreground">{EXAMPLE_SQL_NOTE}</p>
          </div>
        )}

        {reducedMotion && (
          <p className="text-xs text-muted-foreground">
            움직임을 줄이도록 설정해 두셔서 자동으로 넘기지 않습니다. 이전·다음으로
            넘겨 보세요.
          </p>
        )}
      </div>

      {/* 대조 — 블록을 안 쓰면 어떻게 되는가 */}
      <section className="rounded-xl border border-border bg-card/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          문장마다 기능을 만든다면
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-destructive">이렇게 됩니다</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {IF_WE_DID_IT_THE_OTHER_WAY.map((line) => (
                <li key={line} className="text-sm text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-primary">
              블록을 조합하면
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {WHY_IT_MATTERS.map((line) => (
                <li
                  key={line}
                  className="flex gap-1.5 text-sm text-muted-foreground"
                >
                  <span aria-hidden>·</span>
                  <span className="min-w-0 flex-1">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          쓸 수 있는 블록은 이게 전부입니다
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          문장이 늘어도 이 목록은 늘지 않습니다. 늘어나는 것은 조합입니다.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {BLOCK_GROUPS.map((group) => (
            <div key={group.kind}>
              <p className="text-xs font-semibold text-foreground">{group.title}</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {group.blocks.map((block) => (
                  <li key={block.technical} className="flex gap-2 text-sm">
                    <span className="w-24 shrink-0 font-medium text-foreground">
                      {block.label}
                    </span>
                    <span className="min-w-0 flex-1 text-muted-foreground">
                      {block.does}
                      {showTechnical && (
                        <span className="ml-1.5 font-mono text-[10px] opacity-60">
                          {block.technical}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          다른 문장도 같은 블록으로 만들어집니다
        </h2>
        <ul className="mt-2 flex flex-col gap-2.5">
          {OTHER_EXAMPLES.map((example) => (
            <li key={example.sentence}>
              <p className="text-sm text-foreground">“{example.sentence}”</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {example.blocks.map((block) => (
                  <span
                    key={block}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {block}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">{TECHNICAL_NOTE}</p>
    </div>
  );
}
