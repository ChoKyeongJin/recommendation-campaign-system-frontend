"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquareText, Pause, Play } from "lucide-react";

import {
  ASSEMBLY_STEPS,
  BLOCK_GROUPS,
  edgesUpTo,
  EXAMPLE_REQUEST,
  EXAMPLE_SQL,
  EXAMPLE_SQL_NOTE,
  LAST_STEP,
  nodesUpTo,
  OTHER_EXAMPLES,
  TECHNICAL_NOTE,
  TREE_NODES,
  WHY_IT_MATTERS,
  type BlockKind,
} from "@/lib/building-blocks";

/**
 * 문장 하나가 블록으로 조립되는 과정을 단계로 넘겨 보는 그림.
 *
 * 트리와 문구는 `lib/building-blocks.ts` 가 소유한다. 이 파일은 그리기와 단계 넘김만 맡는다.
 */

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 500;
const BOX_W = 186;
const BOX_H = 62;
/** 한 단계를 보여 주는 시간. 읽고 넘어갈 만큼 둔다. */
const STEP_MS = 4200;

const KIND_CLASS: Record<BlockKind, string> = {
  logic: "fill-primary/15 stroke-primary",
  value: "fill-emerald-500/10 stroke-emerald-500",
  relation: "fill-amber-500/10 stroke-amber-500",
  condition: "fill-sky-500/10 stroke-sky-500",
};

const KIND_CHIP: Record<BlockKind, string> = {
  logic: "bg-primary/10 text-primary",
  value: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  relation: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  condition: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function BuildingBlocks() {
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <MessageSquareText
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              조립해 볼 요청
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              “{EXAMPLE_REQUEST}”
            </p>
          </div>
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
            {step}. {current.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{current.plain}</p>
        </div>

        {step === 1 && (
          <div className="flex flex-wrap gap-2 px-1 py-6">
            {["여성 고객", "최근 3개월 동안 구매하지 않은"].map((piece) => (
              <span
                key={piece}
                className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground"
              >
                {piece}
              </span>
            ))}
          </div>
        )}

        {step > 1 && (
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
                  y1={edge.from.y + BOX_H / 2}
                  x2={edge.to.x}
                  y2={edge.to.y - BOX_H / 2}
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
                      y={node.y - BOX_H / 2}
                      width={BOX_W}
                      height={BOX_H}
                      rx={10}
                      className={KIND_CLASS[node.kind]}
                      strokeWidth={justAdded ? 2.5 : 1.5}
                    />
                    <text
                      x={node.x}
                      y={node.y - 12}
                      textAnchor="middle"
                      className="fill-foreground text-[15px] font-semibold"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 6}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[12px]"
                    >
                      {node.detail}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 22}
                      textAnchor="middle"
                      className="fill-muted-foreground/70 font-mono text-[10px]"
                    >
                      {node.technical}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
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

      <section className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          왜 이렇게 만드나요
        </h2>
        <ul className="mt-1.5 flex flex-col gap-1">
          {WHY_IT_MATTERS.map((line) => (
            <li key={line} className="flex gap-1.5 text-sm text-muted-foreground">
              <span aria-hidden>·</span>
              <span className="min-w-0 flex-1">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          쓸 수 있는 블록은 이게 전부입니다
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          문장이 늘어도 이 목록은 늘지 않습니다. 늘어나는 것은 조합입니다.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BLOCK_GROUPS.map((group) => (
            <div key={group.kind}>
              <p className="text-xs font-semibold text-foreground">{group.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {group.blocks.map((block) => (
                  <span
                    key={block.technical}
                    title={block.technical}
                    className={`inline-flex items-baseline gap-1 rounded-md px-2 py-1 text-xs font-medium ${KIND_CHIP[group.kind]}`}
                  >
                    {block.label}
                    <span className="font-mono text-[10px] opacity-60">
                      {block.technical}
                    </span>
                  </span>
                ))}
              </div>
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

/** 트리 블록 수 — 화면 설명 문구가 쓴다. */
export const TREE_BLOCK_COUNT = TREE_NODES.length;
