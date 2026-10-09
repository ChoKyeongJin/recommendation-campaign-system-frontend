"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Coins,
  LoaderCircle,
  Sparkles,
  XCircle,
  ArrowRight,
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Info,
  ShoppingCart,
  Users,
} from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_MODEL_OPTION,
  describeChoice,
  shouldOfferChoice,
  type StructuringModelChoices,
} from "@/lib/structuring-model";
import {
  describeTargetingAccounting,
  type TargetingLlmAccountingEvent,
  type TargetingLlmCallEvent,
  type TargetingProgressState,
} from "@/lib/targeting-progress";

export function AccountingRow({
  accounting,
}: {
  accounting: TargetingLlmAccountingEvent | null;
}) {
  if (!accounting) return null;
  const summary = describeTargetingAccounting(accounting);
  // 적중도 요금도 못 적을 회계는 줄을 만들지 않는다 — 빈 줄은 「0」으로 읽힌다.
  if (!summary.cache && !summary.cost) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      aria-label="LLM 요금과 캐시"
    >
      <Coins className="h-3 w-3 shrink-0" aria-hidden />
      <span className="shrink-0">LLM {accounting.calls}회</span>
      {summary.cache && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{summary.cache}</span>
        </>
      )}
      {summary.cost && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums font-medium text-foreground">
            {summary.cost}
          </span>
        </>
      )}
      {summary.saved && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums text-emerald-600">{summary.saved}</span>
        </>
      )}
      {summary.caveat && (
        <span className="basis-full text-[11px] text-muted-foreground/80">
          {summary.caveat}
        </span>
      )}
    </div>
  );
}

function LlmCallList({ calls }: { calls: TargetingLlmCallEvent[] }) {
  if (calls.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-1" aria-label="LLM 호출">
      {calls.map((call) => {
        const waiting = call.status === "started";
        const failed = call.status === "failed";
        const Icon = waiting ? LoaderCircle : failed ? XCircle : Sparkles;
        const seconds = (call.elapsed_ms / 1000).toFixed(1);
        return (
          <li
            key={call.call_id}
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Icon
              className={`h-3 w-3 shrink-0 ${waiting ? "animate-spin text-primary" : failed ? "text-destructive" : "text-violet-500"}`}
              aria-hidden
            />
            <span className="shrink-0 rounded bg-secondary px-1 font-mono text-[10px] text-secondary-foreground">
              LLM
            </span>
            <span className="shrink-0 font-medium text-foreground">
              {call.label}
            </span>
            <span className="truncate">{call.model}</span>
            {call.reasoning_effort && (
              <span
                className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground"
                title="추론 수준"
              >
                {call.reasoning_effort}
              </span>
            )}
            <span className="ml-auto shrink-0 tabular-nums">
              {waiting ? "응답 대기 중" : failed ? `실패 · ${seconds}초` : `${seconds}초`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const EXAMPLES = [
  "2026년 2월보다 3월 구매금액이 감소한 고객 리스트를 추출해줘",
  "2026년 1월, 2월, 3월에 모두 구매한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품 중 하나 이상을 구매한 고객 리스트를 추출해줘",
  "2026년 캠페인 참여 고객 중 최근 90일간 구매하지 않은 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품을 구매하지 않았지만 같은 카테고리 상품을 구매한 고객 리스트를 추출해줘",
  "불만 접수 또는 부정적인 피드백이 많은 VIP 고객 리스트를 추출해줘",
  "2026년 2월 또는 3월에 진행된 캠페인에 참여했지만 구매까지 전환되지 않은 고객 리스트를 추출해줘",
];

const EXAMPLE_CARDS = [
  { index: 0, category: "구매 감소", tone: "blue", title: "이전 달보다 구매금액이 줄어든 고객", description: "두 달의 구매금액을 비교해 감소한 고객을 찾습니다." },
  { index: 1, category: "충성 고객", tone: "teal", title: "3개월 연속 구매한 고객", description: "지정한 3개월 동안 연속으로 구매한 고객을 찾습니다." },
  { index: 2, category: "인기 상품", tone: "orange", title: "판매 상위 상품을 구매한 고객", description: "특정 기간 동안 판매량 상위 상품을 구매한 고객을 찾습니다." },
  { index: 3, category: "재활성화", tone: "purple", title: "90일간 구매하지 않은 고객", description: "최근 90일간 구매 이력이 없는 캠페인 참여 고객을 찾습니다." },
  { index: 5, category: "고객 케어", tone: "pink", title: "부정적인 피드백이 많은 VIP 고객", description: "불만 접수 또는 부정적인 피드백이 많은 VIP 고객을 찾습니다." },
  { index: 6, category: "전환 유도", tone: "yellow", title: "캠페인 참여 후 구매하지 않은 고객", description: "캠페인에 참여했지만 구매로 전환되지 않은 고객을 찾습니다." },
  { index: 4, category: "관심 상품", tone: "blue", title: "같은 카테고리의 다른 상품을 구매한 고객", description: "인기 상품 대신 같은 카테고리 상품을 구매한 고객을 찾습니다." },
];

export function StepPrompt({
  prompt,
  setPrompt,
  onExtract,
  isExtracting,
  progress,
  error,
  modelChoices,
  structuringModel,
  setStructuringModel,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onExtract: () => void;
  isExtracting: boolean;
  progress: TargetingProgressState;
  error: string | null;
  modelChoices: StructuringModelChoices;
  structuringModel: string;
  setStructuringModel: (v: string) => void;
}) {
  const modelSelectId = useId();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [clientElapsedMs, setClientElapsedMs] = useState(0);
  useEffect(() => {
    if (!isExtracting) return;
    const startedAt = Date.now();
    setClientElapsedMs(0);
    const timer = window.setInterval(
      () => setClientElapsedMs(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [isExtracting]);
  const reportedElapsedMs = progress.stages.reduce(
    (maximum, stage) => Math.max(maximum, stage.elapsed_ms),
    0,
  );
  const elapsedSeconds = Math.floor(
    Math.max(clientElapsedMs, reportedElapsedMs) / 1000,
  );
  const activeStage = progress.stages.find(
    (stage) => stage.status === "started",
  );
  const failedStage = progress.stages.find(
    (stage) => stage.status === "failed",
  );
  const showProgress = isExtracting || Boolean(error && failedStage);

  return (
    <div className="target-prompt-view">
      <div className="target-input-grid">
      <section className="target-input-card" aria-labelledby="target-condition-label">
        <div className="target-card-heading">
          <Label htmlFor="prompt" id="target-condition-label">타겟 조건</Label>
          <span>자연어로 원하는 고객 조건을 입력하세요.</span>
        </div>
        <div className="target-textarea-wrap">
          <Textarea
            ref={promptRef}
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isExtracting}
            placeholder="예) 지난 90일간 구매하지 않은 캠페인 참여 고객"
            aria-describedby="prompt-help prompt-count"
            className="target-textarea"
          />
          <span id="prompt-count" className="prompt-count">{prompt.length.toLocaleString()}자</span>
        </div>
        <p id="prompt-help" className="prompt-help"><Info size={17} aria-hidden />기간, 구매 이력, 캠페인 참여 조건을 함께 입력해 보세요.</p>

        {showProgress && (
          <section
            className="mt-5 rounded-lg border border-border bg-muted/40 p-4"
            aria-label="타겟 추출 진행 상황"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {failedStage
                  ? "타겟 추출 과정에서 문제가 발생했습니다"
                  : "타겟 추출 과정을 진행하고 있습니다"}
              </p>
              <div
                className="flex items-center gap-2 tabular-nums text-xs text-muted-foreground"
                aria-hidden
              >
                {activeStage && (
                  <span>
                    {activeStage.order}/{activeStage.total} 단계
                  </span>
                )}
                {progress.llmCalls.length > 0 && (
                  <span>LLM {progress.llmCalls.length}회</span>
                )}
                <span>{elapsedSeconds}초 경과</span>
              </div>
            </div>
            {progress.accounting && (
              <div className="mb-3 border-t border-border/60 pt-2">
                <AccountingRow accounting={progress.accounting} />
              </div>
            )}
            {progress.stages.length === 0 ? (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                서버에 요청을 전달하고 있습니다.
              </div>
            ) : (
              <ol className="flex flex-col gap-3">
                {progress.stages.map((stage) => {
                  const Icon = stage.status === "completed"
                    ? CheckCircle2
                    : stage.status === "failed"
                      ? XCircle
                      : LoaderCircle;
                  return (
                    <li key={stage.stage} className="flex items-start gap-2.5">
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${stage.status === "started" ? "animate-spin text-primary" : stage.status === "failed" ? "text-destructive" : "text-emerald-600"}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium"
                          {...(stage.status === "started"
                            ? {
                                role: "status",
                                "aria-live": "polite" as const,
                              }
                            : stage.status === "failed"
                              ? {
                                  role: "alert",
                                }
                              : {})}
                        >
                          {stage.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stage.description}
                        </p>
                        <LlmCallList
                          calls={progress.llmCalls.filter(
                            (call) => call.stage === stage.stage,
                          )}
                        />
                      </div>
                    </li>
                  );
                })}
                {progress.llmCalls.some((call) => call.stage === null) && (
                  <li className="flex items-start gap-2.5">
                    <Sparkles
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">단계 밖 LLM 호출</p>
                      <LlmCallList
                        calls={progress.llmCalls.filter(
                          (call) => call.stage === null,
                        )}
                      />
                    </div>
                  </li>
                )}
                {isExtracting &&
                  progress.stages.length < (progress.stages[0]?.total ?? 0) && (
                    <li className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <Circle className="h-4 w-4" aria-hidden /> 다음 단계를 기다리는 중
                    </li>
                  )}
              </ol>
            )}
          </section>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="target-form-actions">
            <div className="target-model-field">
              <label
                htmlFor={modelSelectId}
                className="text-sm font-medium"
              >
                해석 모델
              </label>
              <div className="target-model-select">
              <Brain size={20} aria-hidden />
              {shouldOfferChoice(modelChoices) ? <select
                id={modelSelectId}
                value={structuringModel}
                onChange={(event) => setStructuringModel(event.target.value)}
                disabled={isExtracting}
                title={describeChoice(structuringModel, modelChoices)}
              >
                <option value={DEFAULT_MODEL_OPTION}>
                  {modelChoices.fallback
                    ? `기본 모델 · ${modelChoices.fallback}`
                    : "기본 모델"}
                </option>
                {modelChoices.choices.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select> : <span id={modelSelectId}>기본 모델{modelChoices.fallback ? ` · ${modelChoices.fallback}` : " 사용"}</span>}
              {shouldOfferChoice(modelChoices) && <ChevronDown size={17} className="model-chevron" aria-hidden />}
              </div>
            </div>
          <Button
            onClick={onExtract}
            disabled={!prompt.trim() || isExtracting}
            size="lg"
            className="target-extract-button"
          >
            {isExtracting ? "타겟 추출 중..." : "타겟 추출하기"}
            {isExtracting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
          </Button>
        </div>
      </section>
      <aside className="target-guide" aria-labelledby="target-guide-title">
        <h2 id="target-guide-title">이렇게 입력해 보세요</h2>
        <p>아래 항목을 참고해 원하는 고객을<br className="hidden xl:block" /> 자연어로 설명해 보세요.</p>
        <ul className="target-guide-list">
          {[
            { icon: Users, title: "대상 고객", description: "고객의 특성, 멤버십 등" },
            { icon: CalendarDays, title: "조회 기간", description: "특정 기간의 구매 이력, 캠페인 참여 등" },
            { icon: ShoppingCart, title: "행동 조건", description: "구매, 미구매, 캠페인 참여, 상품 조회 등" },
          ].map(({ icon: Icon, title, description }) => (
            <li key={title}><span className="guide-icon"><Icon size={23} strokeWidth={1.8} aria-hidden /></span><div><h3>{title}</h3><p>{description}</p></div></li>
          ))}
        </ul>
        <div className="guide-example"><span>입력 예시</span><p>“지난 90일간 구매하지 않은 캠페인 참여 고객”</p></div>
      </aside>
      </div>
      <section className="target-examples" aria-labelledby="examples-title">
        <div className="examples-heading">
          <div><h2 id="examples-title">빠르게 시작하기</h2><p>예시를 선택하고 조건을 수정해 보세요.</p></div>
          <button type="button" aria-expanded={showAllExamples} aria-controls="target-example-list" onClick={() => setShowAllExamples(!showAllExamples)}>
            {showAllExamples ? "예시 접기" : "예시 더 보기"}<ArrowRight size={17} aria-hidden />
          </button>
        </div>
        <div id="target-example-list" className="target-example-grid">
          {EXAMPLE_CARDS.slice(0, showAllExamples ? undefined : 6).map((example) => (
            <button type="button" key={example.index} className="target-example-card" disabled={isExtracting}
              onClick={() => { setPrompt(EXAMPLES[example.index]); promptRef.current?.focus(); }}>
              <span className={`example-tag tag-${example.tone}`}>{example.category}</span>
              <h3>{example.title}</h3><p>{example.description}</p><ChevronRight className="example-arrow" size={19} aria-hidden />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
