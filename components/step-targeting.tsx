"use client";

import { Database, Megaphone, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TargetingResult } from "@/lib/campaign-data";

export function StepTargeting({
  result,
  onBack,
  onNext,
  isNextLoading = false,
  nextError = null,
}: {
  result: TargetingResult;
  onBack: () => void;
  onNext: () => void | Promise<void>;
  isNextLoading?: boolean;
  nextError?: string | null;
}) {
  const segmentGroups = result.segmentGroups?.length
    ? result.segmentGroups
    : [{ title: "타겟 조건", segments: result.segments }];
  const metrics = [
    {
      label: "추출된 타겟 고객 수",
      value: result.total,
      suffix: "명",
      icon: Users,
    },
    {
      label: "추천 캠페인 수",
      value: result.targetCampaignCount,
      suffix: "개",
      icon: Megaphone,
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
          <div className="grid gap-3 sm:grid-cols-3">
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
            <p className="text-sm font-medium text-foreground">세그먼트 구성</p>
            {segmentGroups.some((group) => group.segments.length > 0) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {segmentGroups.map((group) => {
                  const max = Math.max(
                    ...group.segments.map((segment) => segment.count ?? 0),
                    0,
                  );
                  return (
                    <div
                      key={group.title}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <p className="mb-3 text-sm font-medium text-foreground">
                        {group.title}
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {group.segments.map((segment) => (
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
                                  style={{
                                    width: `${(segment.count / max) * 100}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
                Python 응답에 세그먼트 구성 정보가 없습니다.
              </p>
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
