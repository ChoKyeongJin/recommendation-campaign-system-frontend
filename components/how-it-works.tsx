"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquareText, Pause, Play, RotateCcw } from "lucide-react";

import {
  AUTHORITY_BOUNDARY,
  CALL_BUDGET,
  EXAMPLE_REQUEST,
  FAIL_CLOSE,
  failCloseIndex,
  LLM_EXCHANGE,
  llmStageIndex,
  PIPELINE_STAGES,
  stageAtProgress,
  TECHNICAL_NOTE,
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
const VIEW_HEIGHT = 330;
const TRACK_Y = 222;
const FIRST_X = 80;
const LAST_X = 920;
const NODE_R = 20;
/** 한 바퀴 도는 데 걸리는 시간. 읽으면서 따라갈 수 있는 속도로 둔다. */
const CYCLE_MS = 13_000;

function nodeX(index: number): number {
  const gaps = PIPELINE_STAGES.length - 1;
  return FIRST_X + ((LAST_X - FIRST_X) / gaps) * index;
}

export function HowItWorks() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [failClose, setFailClose] = useState(false);
  // 움직임을 줄이도록 설정한 사람에게는 아무것도 저절로 움직이지 않아야 한다.
  const [reducedMotion, setReducedMotion] = useState(false);
  const progressRef = useRef(0);

  const llmIndex = llmStageIndex();
  const stopIndex = failCloseIndex();
  // 막히는 모드에서 멈추는 지점 — 그 단계 위에 머무는 구간 안이다.
  const limit = failClose ? (stopIndex + 0.3) / PIPELINE_STAGES.length : 1;

  const seek = useCallback((next: number) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  useEffect(() => {
    // 움직임을 줄이도록 설정했으면 자동 재생하지 않는다.
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setReducedMotion(true);
        setPlaying(false);
      }
    } catch {
      // matchMedia 가 없는 환경에서는 그대로 재생한다.
    }
  }, []);

  // 모드를 바꾸면 처음부터 다시 본다 — 멈추는 지점이 달라지기 때문이다. 멈춰 둔 채로
  // 바꿨어도 다시 돌린다: 이 토글을 누른 이유가 "어떻게 멈추는지 보는 것"인데, 1단계에
  // 세워 두면 정작 그 답을 보여 주지 않는다.
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
    if (!reducedMotion) setPlaying(true);
  }, [failClose, reducedMotion]);

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
  // 아래 설명은 "의미 해석" 인데 상자만 흐려져 둘이 어긋나 보인다.
  const atLlm = activeIndex === llmIndex;
  const stopped = failClose && progress >= limit;

  const llmBoxX = Math.min(Math.max(nodeX(llmIndex) - 150, 20), VIEW_WIDTH - 320);

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
              예시로 따라가는 요청
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              “{EXAMPLE_REQUEST}”
            </p>
          </div>
        </div>

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
          <span className="hidden text-xs text-muted-foreground sm:inline">
            단계를 눌러 건너뛸 수 있습니다
          </span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={failClose}
              onChange={(event) => setFailClose(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            뜻이 확실하지 않으면?
          </label>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="h-auto w-full min-w-[760px]"
            role="img"
            aria-label={`요청이 지나는 ${PIPELINE_STAGES.length}단계. 지금 ${activeStage.label} 단계입니다.`}
          >
            {/* AI 에게 묻는 상자 — 이 배포에서 AI 를 부르는 유일한 자리 */}
            <g>
              <rect
                x={llmBoxX}
                y={18}
                width={300}
                height={58}
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
                y={42}
                className="fill-foreground text-[15px] font-semibold"
              >
                {LLM_EXCHANGE.title}
              </text>
              <text
                x={llmBoxX + 16}
                y={64}
                className="fill-muted-foreground text-[13px]"
              >
                {LLM_EXCHANGE.subtitle}
              </text>
            </g>

            {/* 상자와 의미 해석 단계를 잇는 선 */}
            <line
              x1={nodeX(llmIndex)}
              y1={76}
              x2={nodeX(llmIndex)}
              y2={TRACK_Y - NODE_R - 4}
              className={atLlm ? "stroke-primary" : "stroke-border"}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <text
              x={nodeX(llmIndex) + 12}
              y={110}
              className={
                atLlm
                  ? "fill-primary text-[13px]"
                  : "fill-muted-foreground text-[13px]"
              }
            >
              ↑ 문장과 조건 목록을 보냄
            </text>
            <text
              x={nodeX(llmIndex) + 12}
              y={132}
              className={
                atLlm
                  ? "fill-primary text-[13px]"
                  : "fill-muted-foreground text-[13px]"
              }
            >
              ↓ 무슨 뜻인지 답을 받음 (아직 실행은 아님)
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
                        ? "fill-muted-foreground text-[14px]"
                        : current
                          ? "fill-foreground text-[14px] font-semibold"
                          : "fill-muted-foreground text-[14px]"
                    }
                  >
                    {stage.label}
                  </text>
                  {skipped && (
                    <text
                      x={x}
                      y={TRACK_Y + 68}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[12px]"
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
                y={TRACK_Y - 40}
                textAnchor="middle"
                className="fill-destructive text-[14px] font-semibold"
              >
                여기서 멈춥니다 — 명단을 만들지 않습니다
              </text>
            )}
          </svg>
        </div>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {activeIndex + 1}. {activeStage.label}
          </p>
          <p className="mt-1 text-sm text-foreground">{activeStage.plain}</p>
          <p className="mt-2 border-l-2 border-primary/40 pl-2.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">예를 들면 </span>
            {activeStage.example}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="AI에게 보내는 것" lines={LLM_EXCHANGE.sends} />
        <Panel title="AI가 돌려주는 것" lines={LLM_EXCHANGE.returns} />
        <Panel title="AI가 맡는 일" lines={AUTHORITY_BOUNDARY.model} />
        <Panel
          title="프로그램이 맡는 일"
          lines={AUTHORITY_BOUNDARY.program}
          accent
        />
      </div>

      <Panel title="AI에게 몇 번 묻나요" lines={CALL_BUDGET} />
      <Panel title="확실하지 않으면 어떻게 되나요" lines={FAIL_CLOSE} accent />

      <p className="text-xs text-muted-foreground">{TECHNICAL_NOTE}</p>
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
