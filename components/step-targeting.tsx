"use client";

import { useState } from "react";
import { Database, ListTree, MessageSquareText, Users } from "lucide-react";
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
  TargetingTrace,
  TargetingTraceHit,
  TargetingTraceStep,
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

// 그래프 노드 유형 → 사람이 읽는 한글 라벨.
const NODE_TYPE_LABELS: Record<string, string> = {
  normalization_rule: "정규화 규칙",
  business_term: "업무 용어",
  business_policy: "업무 정책",
  metric_alias: "지표 별칭",
  dimension: "디멘션",
  schema_table: "테이블",
  schema_column: "컬럼",
  sql_example: "SQL 예시",
};

// 엣지 관계명 → 사람이 읽는 한글 라벨.
const RELATION_LABELS: Record<string, string> = {
  has_column: "컬럼 보유",
  foreign_key_to: "외래키",
  references_column: "컬럼 참조",
  references_table: "테이블 참조",
  sql_uses_table: "SQL 사용",
  dimension_filters_column: "디멘션 필터(컬럼)",
  dimension_filters_table: "디멘션 필터(테이블)",
  related: "연관",
};

function nodeTypeLabel(type?: string) {
  if (!type) return "";
  return NODE_TYPE_LABELS[type] ?? type;
}

// intent 코드 → 사람이 읽는 요청 유형.
const INTENT_LABELS: Record<string, string> = {
  recommend_campaign: "캠페인 추천",
  recommend_message: "메시지 추천",
  target_only: "타겟 고객 추출",
};

// summary("intent=recommend_campaign", "8건" 등)를 사람 말로 바꾼다.
function friendlySummary(summary?: string): string | undefined {
  if (!summary) return undefined;
  const intentMatch = summary.match(/^intent=(.+)$/);
  if (intentMatch) {
    const key = intentMatch[1].trim();
    return `요청 유형 · ${INTENT_LABELS[key] ?? key}`;
  }
  return summary;
}

// "sql_example:23" → "23", "schema_column:A.B" → "A.B".
// 타입 접두어는 한글 배지로 따로 보여주므로 라벨에서 제거한다.
function cleanHitLabel(label: string): string {
  const idx = label.indexOf(":");
  if (idx > 0 && NODE_TYPE_LABELS[label.slice(0, idx)]) {
    return label.slice(idx + 1);
  }
  return label;
}

// hit.meta(원본 type) → 한글 배지 문구.
function hitMetaLabel(meta?: string): string {
  if (!meta) return "";
  if (meta === "seed") return "출발점";
  return NODE_TYPE_LABELS[meta] ?? meta;
}

function relationLabel(relation?: string) {
  if (!relation) return "연관";
  return RELATION_LABELS[relation] ?? relation;
}

/** 확장 노드 1개를 '출발점 ─관계→ … → 목표' 브레드크럼으로 렌더링. */
function GraphExpansionPath({ hit }: { hit: TargetingTraceHit }) {
  const path = hit.path ?? [];
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-accent/40 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px]">
        {path.length > 0 ? (
          path.map((node, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <span aria-hidden>─</span>
                  <span className="rounded bg-secondary px-1 py-px text-[9px]">
                    {relationLabel(node.relation)}
                  </span>
                  <span aria-hidden>→</span>
                </span>
              )}
              <span
                className={
                  i === path.length - 1
                    ? "font-mono font-semibold text-foreground"
                    : "font-mono text-muted-foreground"
                }
              >
                {node.label}
              </span>
            </span>
          ))
        ) : (
          <span className="font-mono font-semibold text-foreground">
            {hit.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {typeof hit.distance === "number" && <span>{hit.distance}홉</span>}
        {nodeTypeLabel(hit.nodeType) && (
          <span>· {nodeTypeLabel(hit.nodeType)}</span>
        )}
        {typeof hit.score === "number" && (
          <span className="font-mono">· {hit.score.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}

/**
 * STEP 4(관계 그래프)를 '출발점(검색 매칭) → 관계로 확장된 항목'으로 나눠 보여준다.
 * 확장이 0건이면(고립 노드) 그 사실을 명확히 설명한다.
 */
function GraphExpansionView({ hits }: { hits: TargetingTraceHit[] }) {
  const seeds = hits.filter((hit) => (hit.distance ?? 0) === 0);
  const expanded = hits.filter((hit) => (hit.distance ?? 0) > 0);

  const SEED_LIMIT = 8;
  const EXPANDED_LIMIT = 10;
  const shownSeeds = seeds.slice(0, SEED_LIMIT);
  const seedOverflow = seeds.length - shownSeeds.length;
  const shownExpanded = expanded.slice(0, EXPANDED_LIMIT);
  const expandedOverflow = expanded.length - shownExpanded.length;

  return (
    <div className="mt-2 flex flex-col gap-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {expanded.length > 0 ? (
          <>
            검색으로 찾은{" "}
            <b className="text-foreground">출발점 {seeds.length}개</b>에서 관계를
            타고 <b className="text-foreground">{expanded.length}개 항목</b>으로
            넓혔습니다.
          </>
        ) : (
          <>
            검색으로 찾은{" "}
            <b className="text-foreground">출발점 {seeds.length}개</b>가 그대로
            최종 재료로 쓰였습니다. 이 항목들은 서로 연결된 관계(엣지)가 없어
            추가로 확장된 항목은 없습니다.
          </>
        )}
      </p>

      {shownSeeds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-foreground">
            출발점 · 검색으로 찾은 항목
          </p>
          <div className="flex flex-col gap-1">
            {shownSeeds.map((seed, i) => (
              <div
                key={`${seed.label}-${i}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {seed.label}
                  </span>
                  {nodeTypeLabel(seed.nodeType) && (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[9px] font-normal"
                    >
                      {nodeTypeLabel(seed.nodeType)}
                    </Badge>
                  )}
                </span>
                {typeof seed.score === "number" && (
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {seed.score.toFixed(seed.score < 10 ? 2 : 1)}
                  </span>
                )}
              </div>
            ))}
            {seedOverflow > 0 && (
              <p className="text-[11px] text-muted-foreground">
                외 {seedOverflow}건
              </p>
            )}
          </div>
        </div>
      )}

      {shownExpanded.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <p className="text-[11px] font-semibold text-foreground">
            관계를 타고 확장된 항목
          </p>
          <div className="flex flex-col gap-1.5">
            {shownExpanded.map((node, i) => (
              <GraphExpansionPath key={`${node.label}-${i}`} hit={node} />
            ))}
            {expandedOverflow > 0 && (
              <p className="text-[11px] text-muted-foreground">
                외 {expandedOverflow}건
              </p>
            )}
          </div>
        </div>
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
  const hits = step.hits ?? [];
  const maxScore = Math.max(...hits.map((hit) => hit.score ?? 0), 0);
  const shownHits = hits.slice(0, 6);
  const overflowHits = hits.length - shownHits.length;
  // 관계 그래프(확장) 단계는 distance/path 를 가진 전용 뷰로 렌더링한다.
  const isGraphStep =
    hits.some((hit) => typeof hit.distance === "number") ||
    /관계 그래프|graph|확장/i.test(step.title);

  const summaryText = friendlySummary(step.summary);

  // '자세히(기술 정보)' 토글에 모을 라인들:
  //  - step.details(내부 값·JSON 등)
  //  - 검색 단계면 히트의 원본 ID·관련도 점수(주 화면에선 숨김)
  const technicalLines: string[] = [...(step.details ?? [])];
  if (!isGraphStep) {
    for (const hit of shownHits) {
      const parts = [hit.label];
      if (typeof hit.score === "number") {
        parts.push(`관련도 점수 ${hit.score.toFixed(2)}`);
      }
      technicalLines.push(parts.join(" · "));
    }
  }

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
          {summaryText && (
            <Badge
              variant={step.status === "fail" ? "destructive" : "secondary"}
              className="text-[10px] font-normal"
            >
              {summaryText}
            </Badge>
          )}
        </div>

        {/* 사람 말 설명 (예: 1단계 요청 이해) */}
        {step.plain && step.plain.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {step.plain.map((line, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-foreground"
              >
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                <span className="min-w-0 break-words">{line}</span>
              </li>
            ))}
          </ul>
        )}

        {isGraphStep && hits.length > 0 ? (
          <GraphExpansionView hits={hits} />
        ) : (
          shownHits.length > 0 && (
            <div className="mt-3 flex flex-col gap-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                찾은 지식 · 관련도 순
              </p>
              {shownHits.map((hit, i) => {
                const primary = hit.note || cleanHitLabel(hit.label);
                const metaLabel = hitMetaLabel(hit.meta);
                return (
                  <div key={`${hit.label}-${i}`} className="flex flex-col gap-1">
                    <div className="flex items-start gap-2 text-xs">
                      {metaLabel && (
                        <Badge
                          variant="outline"
                          className="mt-px shrink-0 text-[9px] font-normal"
                        >
                          {metaLabel}
                        </Badge>
                      )}
                      <span className="min-w-0 break-words leading-relaxed text-foreground">
                        {primary}
                      </span>
                    </div>
                    {typeof hit.score === "number" && maxScore > 0 && (
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                        title="관련도"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max((hit.score / maxScore) * 100, 4)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {overflowHits > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  외 {overflowHits}건을 더 참고했어요
                </p>
              )}
            </div>
          )
        )}

        {/* 내부 값·점수·JSON 등은 기본으로 접어 둔다(실패 단계는 펼침). */}
        {technicalLines.length > 0 && (
          <details open={step.status === "fail"} className="group mt-3">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              <span
                className="transition-transform group-open:rotate-90"
                aria-hidden
              >
                ▸
              </span>
              자세히 (기술 정보)
            </summary>
            <ul className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3">
              {technicalLines.map((line, i) => (
                <li
                  key={i}
                  className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground"
                >
                  {line}
                </li>
              ))}
            </ul>
          </details>
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
  const normalizedPrompt = result.normalizedPrompt?.trim();
  const targetingLabel = result.targetingLabel?.trim();
  // 타겟팅 기준 프롬프트: 오디언스만 담은 라벨(offer·행동·채널 제외)이 있으면 그것을 우선 쓰고,
  // 없으면 전체 재작성(normalizedPrompt), 그마저 없으면 원본을 쓴다. 실제 타겟 SQL·세그먼트는
  // 백엔드 effective_query(=normalizedPrompt)를 기준으로 만들어진다(표시값과 별개).
  const targetingPrompt = targetingLabel || normalizedPrompt || trimmedPrompt;
  // 원본과 실제로 달라졌을 때만 원본을 따로 보여준다(동일하면 중복 표시 방지).
  const showOriginalPrompt = Boolean(
    trimmedPrompt && trimmedPrompt !== targetingPrompt,
  );
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
            타겟팅 프롬프트를 기준으로 SQL을 실행한 결과입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {targetingPrompt && (
            <div className="flex gap-3 rounded-lg border border-border bg-accent p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquareText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  타겟팅 프롬프트
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {targetingPrompt}
                </p>
                {(showOriginalPrompt || channel) && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        입력한 프롬프트
                      </p>
                      {/* 발송 채널(LMS/RCS)은 타겟 조건이 아니라 발송 채널이므로 입력 프롬프트 옆에 표시한다. */}
                      {channel && (
                        <Badge variant="secondary" className="text-[10px]">
                          {channel}
                        </Badge>
                      )}
                    </div>
                    {showOriginalPrompt && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {trimmedPrompt}
                      </p>
                    )}
                  </div>
                )}
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
