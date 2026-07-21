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
