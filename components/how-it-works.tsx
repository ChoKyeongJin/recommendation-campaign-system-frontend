"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import {
  AUTHORITY_BOUNDARY,
  CALL_BUDGET,
  FAIL_CLOSE,
  failCloseIndex,
  LLM_EXCHANGE,
  llmStageIndex,
  PIPELINE_STAGES,
  stageAtProgress,
} from "@/lib/how-it-works";

/**
 * 파이프라인을 움직여 보여 주는 그림.
 *
 * 문구와 단계는 `lib/how-it-works.ts` 가 소유한다. 이 파일은 그리기와 재생만 맡는다.
 *
 * 움직임을 줄이도록 설정한 사람에게는 멈춘 채로 시작한다 — 단계를 눌러 직접 넘길 수 있으므로
 * 움직임 없이도 같은 내용을 전부 읽을 수 있다.
 */

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 340;
const TRACK_Y = 230;
const FIRST_X = 80;
const LAST_X = 920;
const NODE_R = 20;
/** 한 바퀴 도는 데 걸리는 시간. 읽으면서 따라갈 수 있는 속도로 둔다. */
const CYCLE_MS = 11_000;

function nodeX(index: number): number {
  const gaps = PIPELINE_STAGES.length - 1;
  return FIRST_X + ((LAST_X - FIRST_X) / gaps) * index;
}

export function HowItWorks() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [failClose, setFailClose] = useState(false);
  const progressRef = useRef(0);

  const llmIndex = llmStageIndex();
  const stopIndex = failCloseIndex();
  // 막히는 모드에서 멈추는 지점 — 그 단계 위에 머무는 구간 안이다.
  const limit = failClose
    ? (stopIndex + 0.3) / PIPELINE_STAGES.length
    : 1;

  const seek = useCallback((next: number) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  useEffect(() => {
    // 움직임을 줄이도록 설정했으면 자동 재생하지 않는다.
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPlaying(false);
      }
    } catch {
      // matchMedia 가 없는 환경에서는 그대로 재생한다.
    }
  }, []);

  // 모드를 바꾸면 처음부터 다시 본다 — 멈추는 지점이 달라지기 때문이다.
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
  }, [failClose]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / CYCLE_MS;
      previous = now;
      let next = progressRef.current + delta;
      if (next >= limit) {
        if (failClose) {
          // 막힌 요청은 되풀이해서 흘러가지 않는다. 멈춘 자리를 그대로 둔다.
          progressRef.current = limit;
          setProgress(limit);
          setPlaying(false);
          return;
        }
        next -= Math.floor(next);
      }
      progressRef.current = next;
      setProgress(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, limit, failClose]);

  const position = stageAtProgress(progress, PIPELINE_STAGES.length);
  const activeIndex = position.index;
  const tokenX =
    nodeX(activeIndex) +
    position.travel * (nodeX(activeIndex + 1) - nodeX(activeIndex));
  const activeStage = PIPELINE_STAGES[activeIndex];
  // 다음 단계로 가는 구간도 아직 이 단계의 시간이다 — 그 사이에 강조가 꺼지면
  // 아래 설명은 "의미 해석" 인데 호출 상자만 흐려져 둘이 어긋나 보인다.
  const atLlm = activeIndex === llmIndex;
  const stopped = failClose && progress >= limit;

  const llmBoxX = Math.min(
    Math.max(nodeX(llmIndex) - 150, 20),
    VIEW_WIDTH - 320,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (stopped) seek(0);
              setPlaying((current) => !current);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            {playing ? "일시정지" : stopped ? "다시 재생" : "재생"}
          </button>
          <button
            type="button"
            onClick={() => seek(0)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            처음부터
          </button>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={failClose}
              onChange={(event) => setFailClose(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            의미를 증명하지 못하면?
          </label>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="h-auto w-full min-w-[760px]"
            role="img"
            aria-label={`타겟 추출 파이프라인 ${PIPELINE_STAGES.length}단계. 지금 ${activeStage.label} 단계입니다.`}
          >
            {/* 모델 호출 상자 — 이 배포에서 provider 를 부르는 유일한 자리 */}
            <g>
              <rect
                x={llmBoxX}
                y={24}
                width={300}
                height={74}
                rx={12}
                className={
                  atLlm
                    ? "fill-primary/10 stroke-primary"
                    : "fill-muted/40 stroke-border"
                }
                strokeWidth={atLlm ? 2 : 1.5}
              />
              <text
                x={llmBoxX + 16}
                y={48}
                className="fill-foreground text-[14px] font-semibold"
              >
                LLM 호출 · {LLM_EXCHANGE.mode}
              </text>
              <text
                x={llmBoxX + 16}
                y={70}
                className="fill-muted-foreground text-[12px]"
              >
                {LLM_EXCHANGE.callLabel} — 요청 하나에 1번
              </text>
              <text
                x={llmBoxX + 16}
                y={88}
                className="fill-muted-foreground text-[12px]"
              >
                원문 전체 + 선언된 후보 메뉴 → 의미 후보
              </text>
            </g>

            {/* 상자와 의미 해석 단계를 잇는 선 */}
            <line
              x1={nodeX(llmIndex)}
              y1={98}
              x2={nodeX(llmIndex)}
              y2={TRACK_Y - NODE_R - 4}
              className={atLlm ? "stroke-primary" : "stroke-border"}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <text
              x={nodeX(llmIndex) + 10}
              y={130}
              className={
                atLlm ? "fill-primary text-[12px]" : "fill-muted-foreground text-[12px]"
              }
            >
              ↑ 원문과 메뉴를 보냄
            </text>
            <text
              x={nodeX(llmIndex) + 10}
              y={150}
              className={
                atLlm ? "fill-primary text-[12px]" : "fill-muted-foreground text-[12px]"
              }
            >
              ↓ 의미 후보를 받음 (실행은 아직 아님)
            </text>

            {/* 트랙 */}
            <line
              x1={FIRST_X}
              y1={TRACK_Y}
              x2={LAST_X}
              y2={TRACK_Y}
              className="stroke-border"
              strokeWidth={3}
              strokeLinecap="round"
            />
            {failClose && (
              <line
                x1={nodeX(stopIndex)}
                y1={TRACK_Y}
                x2={LAST_X}
                y2={TRACK_Y}
                className="stroke-border"
                strokeWidth={3}
                strokeDasharray="4 8"
                strokeLinecap="round"
              />
            )}
            <line
              x1={FIRST_X}
              y1={TRACK_Y}
              x2={Math.max(FIRST_X, tokenX)}
              y2={TRACK_Y}
              className={stopped ? "stroke-destructive" : "stroke-primary"}
              strokeWidth={3}
              strokeLinecap="round"
            />

            {/* 단계 */}
            {PIPELINE_STAGES.map((stage, index) => {
              const x = nodeX(index);
              const done = index < activeIndex;
              const current = index === activeIndex;
              const skipped = failClose && index > stopIndex;
              return (
                <g
                  key={stage.id}
                  onClick={() => {
                    setPlaying(false);
                    seek((index + 0.3) / PIPELINE_STAGES.length);
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={x}
                    cy={TRACK_Y}
                    r={NODE_R}
                    className={
                      skipped
                        ? "fill-background stroke-border"
                        : current && stopped
                          ? "fill-destructive/10 stroke-destructive"
                          : current
                            ? "fill-background stroke-primary"
                            : done
                              ? "fill-primary stroke-primary"
                              : "fill-background stroke-border"
                    }
                    strokeWidth={current ? 3 : 1.5}
                    strokeDasharray={skipped ? "3 3" : undefined}
                  />
                  <text
                    x={x}
                    y={TRACK_Y + 5}
                    textAnchor="middle"
                    className={
                      done && !skipped
                        ? "fill-primary-foreground text-[13px] font-semibold"
                        : skipped
                          ? "fill-muted-foreground text-[13px]"
                          : "fill-foreground text-[13px] font-semibold"
                    }
                  >
                    {index + 1}
                  </text>
                  <text
                    x={x}
                    y={TRACK_Y + 48}
                    textAnchor="middle"
                    className={
                      skipped
                        ? "fill-muted-foreground text-[13px]"
                        : current
                          ? "fill-foreground text-[13px] font-semibold"
                          : "fill-muted-foreground text-[13px]"
                    }
                  >
                    {stage.label}
                  </text>
                  {skipped && (
                    <text
                      x={x}
                      y={TRACK_Y + 66}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      돌지 않음
                    </text>
                  )}
                </g>
              );
            })}

            {/* 요청 표시 */}
            <circle
              cx={tokenX}
              cy={TRACK_Y}
              r={atLlm ? 11 : 8}
              className={stopped ? "fill-destructive" : "fill-primary"}
            />
            {stopped && (
              <text
                x={nodeX(stopIndex)}
                y={TRACK_Y - 44}
                textAnchor="middle"
                className="fill-destructive text-[13px] font-semibold"
              >
                여기서 멈춥니다 — SQL 을 만들지 않습니다
              </text>
            )}
          </svg>
        </div>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {activeIndex + 1}. {activeStage.label}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeStage.description}
          </p>
          <p className="mt-1 text-sm text-foreground">{activeStage.principle}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="모델에게 보내는 것" lines={LLM_EXCHANGE.sends} />
        <Panel title="모델이 돌려주는 것" lines={LLM_EXCHANGE.returns} />
        <Panel title="모델이 제안하는 것" lines={AUTHORITY_BOUNDARY.model} />
        <Panel
          title="프로그램만 정하는 것"
          lines={AUTHORITY_BOUNDARY.program}
          accent
        />
      </div>

      <Panel title="호출은 몇 번인가" lines={CALL_BUDGET} />
      <Panel title="증명하지 못하면" lines={FAIL_CLOSE} accent />
    </div>
  );
}

function Panel({
  title,
  lines,
  accent = false,
}: {
  title: string;
  lines: readonly string[];
  accent?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border px-4 py-3 ${
        accent ? "border-primary/30 bg-primary/5" : "border-border bg-card/60"
      }`}
    >
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-1.5 flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line} className="flex gap-1.5 text-sm text-muted-foreground">
            <span aria-hidden>·</span>
            <span className="min-w-0 flex-1">{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
