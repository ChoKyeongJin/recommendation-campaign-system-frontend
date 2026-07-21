"use client";

import { useState } from "react";
import { Database, MessageSquareText, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  Channel,
  TargetSegment,
  TargetSegmentGroup,
  TargetingResult,
} from "@/lib/campaign-data";

// 롱테일(자유형 행동·관심사 등)로 그룹이 길어지는 것을 막기 위한 기본 표시 개수.
const DEFAULT_VISIBLE_SEGMENTS = 6;

function SegmentGroupCard({ group }: { group: TargetSegmentGroup }) {
  const [expanded, setExpanded] = useState(false);

  // SQL이 count 내림차순으로 주지만 count 누락 대비해 한 번 더 정렬.
  const sorted: TargetSegment[] = [...group.segments].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0),
  );
  const max = Math.max(...sorted.map((segment) => segment.count ?? 0), 0);
  const visible = expanded
    ? sorted
    : sorted.slice(0, DEFAULT_VISIBLE_SEGMENTS);
  const overflowCount = sorted.length - visible.length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">{group.title}</p>
      {group.reason && (
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          {group.reason}
        </p>
      )}
      <div className={`flex flex-col gap-2.5 ${group.reason ? "" : "mt-3"}`}>
        {visible.map((segment) => (
          <div
            key={`${group.title}-${segment.label}`}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">
                {segment.label}
              </span>
              {typeof segment.count === "number" && (
                <span className="shrink-0 font-medium text-muted-foreground">
                  {segment.count.toLocaleString()}명
                </span>
              )}
            </div>
            {typeof segment.count === "number" && max > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(segment.count / max) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {(overflowCount > 0 || expanded) &&
        sorted.length > DEFAULT_VISIBLE_SEGMENTS && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "접기" : `외 ${overflowCount}개 더보기`}
          </button>
        )}
    </div>
  );
}

function TraceStepCard({
  step,
  index,
}: {
  step: TargetingTraceStep;
  index: number;
}) {
  const maxScore = Math.max(
    ...(step.hits ?? []).map((hit) => hit.score ?? 0),
    0,
  );
  const shownHits = (step.hits ?? []).slice(0, 6);
  const overflowHits = (step.hits ?? []).length - shownHits.length;

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {index + 1}
        </span>
        <span className="mt-1 w-px flex-1 bg-border last:hidden" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{step.title}</p>
          {step.summary && (
            <Badge
              variant={step.status === "fail" ? "destructive" : "secondary"}
              className="font-mono text-[10px]"
            >
              {step.summary}
            </Badge>
          )}
        </div>

        {step.details && step.details.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {step.details.map((detail, i) => (
              <li
                key={i}
                className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground"
              >
                {detail}
              </li>
            ))}
          </ul>
        )}

        {shownHits.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {shownHits.map((hit, i) => (
              <div key={`${hit.label}-${i}`} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate font-mono text-foreground">
                      {hit.label}
                    </span>
                    {hit.meta && (
                      <Badge
                        variant={hit.meta === "seed" ? "default" : "outline"}
                        className="shrink-0 text-[9px]"
                      >
                        {hit.meta}
                      </Badge>
                    )}
                  </span>
                  {typeof hit.score === "number" && (
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {hit.score.toFixed(hit.score < 10 ? 3 : 2)}
                    </span>
                  )}
                </div>
                {typeof hit.score === "number" && maxScore > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(hit.score / maxScore) * 100}%` }}
                    />
                  </div>
                )}
                {hit.note && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {hit.note}
                  </p>
                )}
              </div>
            ))}
            {overflowHits > 0 && (
              <p className="text-[11px] text-muted-foreground">
                외 {overflowHits}건
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function TraceSection({
  prompt,
  channel,
}: {
  prompt?: string;
  channel?: Channel;
}) {
  const [trace, setTrace] = useState<TargetingTrace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedPrompt = prompt?.trim();
  const canFetch = Boolean(trimmedPrompt && channel);

  const loadTrace = async () => {
    if (!canFetch || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/targeting/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt, channel }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data && typeof data.error === "string"
            ? data.error
            : "추론 과정 조회에 실패했습니다.";
        throw new Error(message);
      }

      setTrace(data as TargetingTrace);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "추론 과정 조회에 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <ListTree className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-base">AI 추론 과정</CardTitle>
        </div>
        {trace && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTrace}
            disabled={isLoading}
          >
            {isLoading ? "불러오는 중..." : "다시 불러오기"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!trace && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              의미 추론 → 벡터·키워드 검색 → Graph 확장 → SQL 생성/검증까지, 이
              타겟팅이 어떻게 만들어졌는지 단계별로 확인할 수 있습니다.
            </p>
            <Button onClick={loadTrace} disabled={!canFetch || isLoading}>
              {isLoading ? "불러오는 중..." : "추론 과정 보기"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {trace && (
          <div className="flex flex-col gap-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {trace.steps.length > 0 ? (
              <ol className="flex flex-col">
                {trace.steps.map((step, index) => (
                  <TraceStepCard
                    key={`${step.title}-${index}`}
                    step={step}
                    index={index}
                  />
                ))}
              </ol>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  구조화된 추론 단계를 찾지 못했습니다. 원본 응답을 표시합니다.
                </p>
                {trace.raw !== undefined && (
                  <pre className="max-h-80 overflow-auto rounded-lg bg-foreground p-4 text-xs leading-relaxed text-background">
                    <code className="font-mono">
                      {JSON.stringify(trace.raw, null, 2)}
                    </code>
                  </pre>
                )}
              </div>
            )}

            {(trace.result?.status ||
              typeof trace.result?.success === "boolean" ||
              trace.result?.message ||
              trace.execution) && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-accent p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {(trace.result?.status ||
                    typeof trace.result?.success === "boolean") && (
                    <Badge
                      variant={
                        trace.result?.success === false
                          ? "destructive"
                          : "default"
                      }
                      className="font-mono text-[10px]"
                    >
                      RESULT: {trace.result?.status ??
                        (trace.result?.success ? "success" : "fail")}
                    </Badge>
                  )}
                  {typeof trace.execution?.targetCustomerCount === "number" && (
                    <span className="font-mono text-xs text-foreground">
                      EXEC: target_customer_count=
                      <span className="font-bold">
                        {trace.execution.targetCustomerCount.toLocaleString()}
                      </span>
                    </span>
                  )}
                  {typeof trace.execution?.resultRowCount === "number" && (
                    <span className="font-mono text-xs text-muted-foreground">
                      result_row_count={trace.execution.resultRowCount.toLocaleString()}
                    </span>
                  )}
                  {typeof trace.execution?.targetCampaignCount === "number" && (
                    <span className="font-mono text-xs text-muted-foreground">
                      target_campaign_count=
                      {trace.execution.targetCampaignCount.toLocaleString()}
                    </span>
                  )}
                </div>
                {trace.result?.message && (
                  <p className="text-xs text-muted-foreground">
                    {trace.result.message}
                  </p>
                )}
              </div>
            )}

            {trace.timings && trace.timings.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3">
                {trace.timings.map((timing) => (
                  <span
                    key={timing.label}
                    className="font-mono text-[11px] text-muted-foreground"
                  >
                    {timing.label}={timing.ms.toLocaleString()}ms
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StepTargeting({
  result,
  prompt,
  channel,
  onBack,
  onNext,
  isNextLoading = false,
  nextError = null,
}: {
  result: TargetingResult;
  prompt?: string;
  channel?: Channel;
  onBack: () => void;
  onNext: () => void | Promise<void>;
  isNextLoading?: boolean;
  nextError?: string | null;
}) {
  const trimmedPrompt = prompt?.trim();
  const segmentGroups = result.segmentGroups?.length
    ? result.segmentGroups
    : [{ title: "타겟 조건", segments: result.segments }];
  const hiddenSegmentGroups = (result.hiddenSegmentGroups ?? []).filter(
    (group) => group.segments.length > 0,
  );
  const metrics = [
    {
      label: "추출된 타겟 고객 수",
      value: result.total,
      suffix: "명",
      icon: Users,
    },
    {
      label: "조회 결과 행 수",
      value: result.resultRowCount,
      suffix: "건",
      icon: Database,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>타겟팅 결과</CardTitle>
          <CardDescription>
            입력한 조건으로 SQL을 실행한 결과입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {trimmedPrompt && (
            <div className="flex gap-3 rounded-lg border border-border bg-accent p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquareText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    입력한 프롬프트
                  </p>
                  {channel && (
                    <Badge variant="secondary" className="text-[10px]">
                      {channel}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {trimmedPrompt}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="flex items-center gap-3 rounded-lg border border-border bg-accent p-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="font-sans text-2xl font-bold text-foreground">
                      {typeof metric.value === "number"
                        ? metric.value.toLocaleString()
                        : "-"}
                      {typeof metric.value === "number" && (
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          {metric.suffix}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {result.message && (
            <p className="rounded-lg border border-border bg-secondary p-3 text-sm text-secondary-foreground">
              {result.message}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">세그먼트 구성</p>
              <p className="text-xs text-muted-foreground">
                질문과 관련된 타겟 조건 위주로 보여줍니다.
              </p>
            </div>
            {segmentGroups.some((group) => group.segments.length > 0) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {segmentGroups.map((group) => (
                  <SegmentGroupCard key={group.title} group={group} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
                Python 응답에 세그먼트 구성 정보가 없습니다.
              </p>
            )}

            {hiddenSegmentGroups.length > 0 && (
              <details className="group rounded-lg border border-border bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-medium text-foreground">
                  <span>
                    그 외 프로필 통계 {hiddenSegmentGroups.length}개 보기
                    <span className="ml-1 font-normal text-muted-foreground">
                      (성별·연령·지역·관심사 등)
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground transition-transform group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
                  {hiddenSegmentGroups.map((group) => (
                    <SegmentGroupCard key={group.title} group={group} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">실행된 SQL</CardTitle>
          <Badge variant="secondary">read-only</Badge>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-foreground p-4 text-xs leading-relaxed text-background">
            <code className="font-mono">{result.sql}</code>
          </pre>
        </CardContent>
      </Card>

      <TraceSection prompt={prompt} channel={channel} />

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <div className="flex flex-col items-end gap-2">
          {nextError && <p className="text-sm text-destructive">{nextError}</p>}
          <Button onClick={onNext} size="lg" disabled={isNextLoading}>
            {isNextLoading ? "메시지 추천 중..." : "메시지 추천 받기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
