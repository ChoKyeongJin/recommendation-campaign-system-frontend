"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Cog,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

import {
  ABSENCE_BRANCH,
  ABSENCE_SEQUENCE,
  ACTORS,
  ASSEMBLY_STEPS,
  BLOCK_GROUPS,
  BOUNDARY_FLOW,
  BOUNDARY_FLOW_NOTE,
  branchStep,
  edgesUpTo,
  EXAMPLE_SQL,
  EXAMPLE_SQL_NOTE,
  IF_WE_DID_IT_THE_OTHER_WAY,
  LAST_STEP,
  MAPPING_NOTE,
  MEANING_TO_BLOCKS,
  MODEL_CANNOT,
  MODEL_EXCHANGE,
  MODEL_STEP,
  nodesUpTo,
  OFF_MENU,
  OTHER_EXAMPLES,
  PROGRAM_CHECKS,
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

/** 행위자 배지 — AI 단계와 규칙 단계가 한눈에 갈려야 한다. */
const ACTOR_BADGE = {
  ai: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  program: "border-border bg-muted text-muted-foreground",
} as const;

function ActorBadge({ actor }: { actor: keyof typeof ACTOR_BADGE }) {
  const Icon = actor === "ai" ? Sparkles : Cog;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTOR_BADGE[actor]}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {ACTORS[actor].label}
    </span>
  );
}

/** 사슬 그림 — 칸 크기와 간격. 자리는 선언 순서에서 센다. */
const FLOW_BOX_W = 168;
const FLOW_BOX_H = 82;
const FLOW_GAP = 30;

/** 사슬 칸의 색 — AI 칸만 다르다. 그것이 이 그림의 전부다. */
const FLOW_BOX: Record<(typeof BOUNDARY_FLOW)[number]["lane"], string> = {
  user: "fill-muted stroke-border",
  ai: "fill-amber-500/15 stroke-amber-500",
  program: "fill-primary/10 stroke-primary/50",
};

/**
 * 「AI 는 이 사슬에서 한 칸」을 그린다.
 *
 * 칸 수가 늘어도 viewBox 가 함께 늘어나므로 좌표를 손으로 고칠 일이 없다.
 */
function BoundaryFlow({ showTechnical }: { showTechnical: boolean }) {
  const width =
    BOUNDARY_FLOW.length * FLOW_BOX_W + (BOUNDARY_FLOW.length - 1) * FLOW_GAP;
  const height = FLOW_BOX_H + 40;
  const boxY = 24;
  const aiCount = BOUNDARY_FLOW.filter((cell) => cell.lane === "ai").length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full min-w-[840px]"
      role="img"
      aria-label={`요청이 지나는 칸 ${BOUNDARY_FLOW.length}개 가운데 AI 칸은 ${aiCount}개입니다.`}
    >
      {BOUNDARY_FLOW.map((cell, index) => {
        const x = index * (FLOW_BOX_W + FLOW_GAP);
        const centerX = x + FLOW_BOX_W / 2;
        return (
          <g key={cell.label}>
            {index > 0 && (
              <line
                x1={x - FLOW_GAP + 5}
                y1={boxY + FLOW_BOX_H / 2}
                x2={x - 5}
                y2={boxY + FLOW_BOX_H / 2}
                className="stroke-border"
                strokeWidth={2}
              />
            )}
            <rect
              x={x}
              y={boxY}
              width={FLOW_BOX_W}
              height={FLOW_BOX_H}
              rx={10}
              className={FLOW_BOX[cell.lane]}
              strokeWidth={cell.lane === "ai" ? 2.5 : 1.5}
            />
            <text
              x={centerX}
              y={boxY - 8}
              textAnchor="middle"
              className={
                cell.lane === "ai"
                  ? "fill-amber-600 text-[11px] font-semibold dark:fill-amber-400"
                  : "fill-muted-foreground text-[11px]"
              }
            >
              {cell.lane === "user" ? "사용자" : ACTORS[cell.lane].label}
            </text>
            <text
              x={centerX}
              y={boxY + 27}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
            >
              {cell.label}
            </text>
            <foreignObject x={x + 6} y={boxY + 34} width={FLOW_BOX_W - 12} height={44}>
              <p className="text-center text-[11px] leading-tight text-muted-foreground">
                {cell.note}
              </p>
            </foreignObject>
            {showTechnical && cell.technical && (
              <text
                x={centerX}
                y={boxY + FLOW_BOX_H + 14}
                textAnchor="middle"
                className="fill-muted-foreground/70 font-mono text-[10px]"
              >
                {cell.technical}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** 펼침 그림 — 뜻 칸과 블록 칸의 크기. */
const FAN_MEANING_W = 250;
const FAN_MEANING_H = 66;
const FAN_BLOCK_W = 150;
const FAN_BLOCK_H = 32;
const FAN_BLOCK_GAP = 9;
const FAN_GROUP_GAP = 26;
/** 열 제목이 들어가는 위쪽 여백. */
const FAN_TOP_PAD = 26;
const FAN_COL_GAP = 140;

/**
 * 「뜻 하나가 블록 여럿으로」를 그린다.
 *
 * 왼쪽 한 칸에서 오른쪽 여러 칸으로 선이 갈라지는 것이 이 그림의 주장이다. 블록을 세로로
 * 쌓고 뜻 칸을 그 묶음의 가운데에 두므로, 묶음이 커지면 그림이 알아서 길어진다.
 */
function MeaningFan({ showTechnical }: { showTechnical: boolean }) {
  // 한 줄의 높이는 블록 묶음과 뜻 칸 가운데 **큰 쪽**이다. 묶음만 재면 블록이 하나뿐인 줄에서
  // 뜻 칸이 그 줄보다 커져 그림 밖으로 잘린다(실제로 마지막 줄이 잘렸다).
  let cursor = 0;
  const groups = MEANING_TO_BLOCKS.map((row) => {
    const blocksH =
      row.blocks.length * FAN_BLOCK_H + (row.blocks.length - 1) * FAN_BLOCK_GAP;
    const rowH = Math.max(blocksH, FAN_MEANING_H);
    const top = cursor;
    cursor += rowH + FAN_GROUP_GAP;
    return { row, top, rowH, blocksH };
  });
  const height = FAN_TOP_PAD + Math.max(0, cursor - FAN_GROUP_GAP) + 6;
  const width = FAN_MEANING_W + FAN_COL_GAP + FAN_BLOCK_W + 30;
  const blockX = FAN_MEANING_W + FAN_COL_GAP;
  const blockCount = MEANING_TO_BLOCKS.reduce(
    (sum, row) => sum + row.blocks.length,
    0,
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full min-w-[520px] max-w-[660px]"
      role="img"
      aria-label={`AI가 고른 뜻 ${MEANING_TO_BLOCKS.length}개가 블록 ${blockCount}개로 펼쳐집니다.`}
    >
      <text
        x={0}
        y={12}
        className="fill-amber-600 text-[11px] font-semibold dark:fill-amber-400"
      >
        AI가 고른 뜻
      </text>
      <text x={blockX} y={12} className="fill-muted-foreground text-[11px] font-semibold">
        대응표가 낸 블록
      </text>

      {groups.map(({ row, top, rowH, blocksH }) => {
        const blocksTop = FAN_TOP_PAD + top + (rowH - blocksH) / 2;
        const meaningY = FAN_TOP_PAD + top + (rowH - FAN_MEANING_H) / 2;
        const meaningCenterY = meaningY + FAN_MEANING_H / 2;
        return (
          <g key={row.meaning}>
            {row.blocks.map((block, index) => {
              const y = blocksTop + index * (FAN_BLOCK_H + FAN_BLOCK_GAP);
              return (
                <g key={block}>
                  <line
                    x1={FAN_MEANING_W}
                    y1={meaningCenterY}
                    x2={blockX}
                    y2={y + FAN_BLOCK_H / 2}
                    className="stroke-border"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={blockX}
                    y={y}
                    width={FAN_BLOCK_W}
                    height={FAN_BLOCK_H}
                    rx={8}
                    className={BRANCH_BOX[row.branch]}
                    strokeWidth={1.5}
                  />
                  <text
                    x={blockX + FAN_BLOCK_W / 2}
                    y={y + FAN_BLOCK_H / 2 + 4}
                    textAnchor="middle"
                    className="fill-foreground text-[12px] font-medium"
                  >
                    {block} 블록
                  </text>
                </g>
              );
            })}
            <rect
              x={0}
              y={meaningY}
              width={FAN_MEANING_W}
              height={FAN_MEANING_H}
              rx={10}
              className="fill-amber-500/10 stroke-amber-500"
              strokeWidth={1.5}
            />
            <text
              x={FAN_MEANING_W / 2}
              y={meaningY + (showTechnical ? 21 : 26)}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
            >
              {row.meaning}
            </text>
            <text
              x={FAN_MEANING_W / 2}
              y={meaningY + (showTechnical ? 38 : 45)}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {row.branch === "root" ? "두 조각을 한꺼번에 말했다" : row.piece}
            </text>
            {showTechnical && (
              <text
                x={FAN_MEANING_W / 2}
                y={meaningY + 55}
                textAnchor="middle"
                className="fill-muted-foreground/70 font-mono text-[10px]"
              >
                {row.technical}
              </text>
            )}
            <text
              x={blockX + FAN_BLOCK_W + 8}
              y={meaningCenterY + 4}
              className="fill-muted-foreground text-[11px]"
            >
              {row.blocks.length}개
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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
                aria-label={`${index + 1}단계: ${ACTORS[assemblyStep.actor].label} · ${assemblyStep.title}`}
                aria-current={step === index + 1}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  step === index + 1
                    ? assemblyStep.actor === "ai"
                      ? "bg-amber-500"
                      : "bg-primary"
                    : step > index + 1
                      ? assemblyStep.actor === "ai"
                        ? "bg-amber-500/40"
                        : "bg-primary/40"
                      : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 이 토글은 트리와 아래 구역들의 기술 이름을 함께 켠다. 1단계에서도 아래 구역이 이미
            보이므로 단계로 가리지 않는다. */}
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

        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {step}단계. {current.title}
            </p>
            <ActorBadge actor={current.actor} />
            <span className="text-xs text-muted-foreground">
              {ACTORS[current.actor].note}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{current.plain}</p>

          {step === MODEL_STEP && (
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">
                  AI에게 보내는 것
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {MODEL_EXCHANGE.sends.map((item) => (
                    <li key={item.label} className="text-sm">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground"> — {item.detail}</span>
                      {showTechnical && (
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground/70">
                          {item.technical}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  AI가 돌려주는 것
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {MODEL_EXCHANGE.returns.map((item) => (
                    <li key={item.label} className="text-sm">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground"> — {item.detail}</span>
                      {showTechnical && (
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground/70">
                          {item.technical}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === branchStep(ABSENCE_BRANCH) && (
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
                {step === MODEL_STEP
                  ? "AI가 고른 뜻을 말로 읽으면 "
                  : "지금까지 조립한 것을 말로 읽으면 "}
              </span>
              “{current.readback}”
            </p>
          )}
        </div>

        {nodes.length === 0 && (
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

        {nodes.length > 0 && (
          <>
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

      {/* 경계 — 블록을 고르는 것은 AI 가 아니다 */}
      <section className="rounded-xl border border-border bg-card/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          블록은 누가 고르나
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          AI는 조각마다 <strong className="font-semibold text-foreground">뜻 하나</strong>를
          고릅니다. 그 뜻이 어떤 블록 몇 개로 펼쳐지는지는 미리 적어 둔 대응표가 정합니다.
        </p>

        <div className="mt-3 overflow-x-auto">
          <BoundaryFlow showTechnical={showTechnical} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{BOUNDARY_FLOW_NOTE}</p>

        <div className="mt-4 overflow-x-auto">
          <MeaningFan showTechnical={showTechnical} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{MAPPING_NOTE}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-destructive">
              AI가 아예 낼 수 없는 것
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {MODEL_CANNOT.map((line) => (
                <li key={line} className="flex gap-1.5 text-sm text-muted-foreground">
                  <span aria-hidden>·</span>
                  <span className="min-w-0 flex-1">{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-primary">
              AI의 답을 받은 뒤 대조하는 것
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {PROGRAM_CHECKS.map((line) => (
                <li key={line} className="flex gap-1.5 text-sm text-muted-foreground">
                  <span aria-hidden>·</span>
                  <span className="min-w-0 flex-1">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">
            메뉴에 없는 뜻을 만나면
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {OFF_MENU.map((line) => (
              <li key={line} className="flex gap-1.5 text-sm text-muted-foreground">
                <span aria-hidden>·</span>
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
