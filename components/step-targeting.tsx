"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Check,
  Copy,
  Database,
  MessageSquareText,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClarificationPanel } from "@/components/clarification-panel";
import { AccountingRow } from "@/components/step-prompt";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatSql } from "@/lib/sql-format";
import { targetingOutcome } from "@/lib/targeting-outcome";
import type { TargetingLlmAccountingEvent } from "@/lib/targeting-progress";
import type {
  ClarificationAnswer,
  TargetSegment,
  TargetSegmentGroup,
  TargetingResult,
} from "@/lib/campaign-data";

// 롱테일(자유형 행동·관심사 등)로 그룹이 길어지는 것을 막기 위한 기본 표시 개수.
const DEFAULT_VISIBLE_SEGMENTS = 6;

// 코드 블록 우상단에 얹는 복사 버튼. 복사 성공 시 잠깐 체크 아이콘으로 바뀐다.
function CopyButton({ text }: { text: string }) {
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");

  const handleCopy = async () => {
    const copied = await copyTextToClipboard(text);
    setCopyStatus(copied ? "copied" : "failed");
    setTimeout(() => setCopyStatus("idle"), 1500);
  };

  const copied = copyStatus === "copied";
  const label = copied
    ? "복사됨"
    : copyStatus === "failed"
      ? "복사 실패"
      : "쿼리 복사";

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      aria-live="polite"
      title={label}
      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-background/10 px-2 py-1 text-xs text-background transition-colors hover:bg-background/20"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          복사됨
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {copyStatus === "failed" ? "복사 실패" : "복사"}
        </>
      )}
    </button>
  );
}

function SegmentGroupCard({ group }: { group: TargetSegmentGroup }) {
  const [expanded, setExpanded] = useState(false);

  // SQL이 count 내림차순으로 주지만 count 누락 대비해 한 번 더 정렬.
  const sorted: TargetSegment[] = [...group.segments].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0),
  );
  const max = Math.max(...sorted.map((segment) => segment.count ?? 0), 0);
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE_SEGMENTS);
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

// 사용자가 직접 다시 시도할 수 있는 근거가 있을 때만 보여 주는 안내 카드.
function FailureReasonCard({ result, reason }: { result: TargetingResult; reason: string }) {
  const explanation = result.failureExplanation;
  const conditions = explanation?.supportLimit?.blockedConditions ?? [];
  return (
    <Card className="border-destructive/40">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <Ban className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <CardTitle className="text-base">요청을 처리하지 못했습니다</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{reason}</p>
        {conditions.map((condition, index) => (
          <div key={index} className="rounded-lg border border-border bg-secondary p-3">
            <p className="text-sm font-medium">{condition.text}</p>
            <p className="mt-1 text-sm text-muted-foreground">{condition.reason}</p>
          </div>
        ))}
        {explanation?.developerDiagnostic && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">관리자용 정보</summary>
            <pre className="mt-3 overflow-x-auto text-[11px]">
              <code>{JSON.stringify(explanation.developerDiagnostic, null, 2)}</code>
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

const NO_CLARIFICATION_ANSWERS: ClarificationAnswer[] = [];

export function StepTargeting({
  accounting,
  result,
  prompt,
  onBack,
  onClarify,
  onPickAlternative,
  isClarifying = false,
  clarificationAnswers = NO_CLARIFICATION_ANSWERS,
}: {
  result: TargetingResult;
  prompt?: string;
  onBack: () => void;
  /** 이 요청이 provider 에 낸 요금과 캐시 회계. 없으면 줄을 만들지 않는다. */
  accounting: TargetingLlmAccountingEvent | null;
  /** 되묻기 답을 모아 다시 추출한다(프롬프트는 그대로). */
  onClarify?: (answers: ClarificationAnswer[]) => void | Promise<void>;
  /** 보기 문장을 골랐다 — 프롬프트를 그 문장으로 바꿔 다시 추출한다. */
  onPickAlternative?: (query: string) => void | Promise<void>;
  isClarifying?: boolean;
  clarificationAnswers?: ClarificationAnswer[];
}) {
  // 출고된 SQL 은 WHERE 본문이 한 줄로 나와 가로로 밀려 나간다. 보이는 것만 줄바꿈한다 —
  // `formatSql` 은 토큰을 더하거나 빼지 않고 사이의 공백만 다시 쓴다.
  const formattedSql = useMemo(
    () => (result.sql ? formatSql(result.sql) : null),
    [result.sql],
  );
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
  // 질문이 지목한 축을 앞에, 그 밖의 프로필 통계를 뒤에 두고 **접지 않고** 한 번에 보여 준다.
  // 내용이 없는 묶음은 빼므로, 볼 것이 하나도 없으면 이 자리 자체가 나타나지 않는다 —
  // 아래에 통계가 뻔히 있는데 "정보가 없습니다" 라고 적혀 있던 자리를 그렇게 없앴다.
  // 같은 제목이 양쪽에 들어오면 같은 카드가 두 번 뜬다. 앞쪽(질문이 지목한 것)을 남긴다.
  const visibleSegmentGroups = [...segmentGroups, ...hiddenSegmentGroups].filter(
    (group, index, groups) =>
      group.segments.length > 0 &&
      groups.findIndex((other) => other.title === group.title) === index,
  );
  // 실제 선택 보기가 있는 요청만 확인 단계로 남긴다.
  const outcome = targetingOutcome(result);
  const awaitingClarification = outcome.kind === "choice";
  const isFailed = outcome.kind === "failure";
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
          <CardTitle>{awaitingClarification ? "타겟 조건 확인" : "타겟팅 결과"}</CardTitle>
          <CardDescription>
            {awaitingClarification
              ? "아직 고객을 추출하지 않았습니다. 아래 조건을 확인해 주세요."
              : isFailed
                ? "요청을 완료하지 못했습니다. 아래에서 실패 이유를 확인할 수 있습니다."
                : "타겟팅 프롬프트를 기준으로 SQL을 실행한 결과입니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <AccountingRow accounting={accounting} />
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
                {showOriginalPrompt && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      입력한 프롬프트
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {trimmedPrompt}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 확정 계층 패널 — 시스템이 채운 값과 그것을 다르게 둔 요청 문장 보기.
              프롬프트 바로 아래에 두는 이유는, 사용자가 SQL 을 읽기 전에 "무엇으로 돌았는지"를
              먼저 알아야 하기 때문이다. */}
          {result.resolution && (awaitingClarification || !isFailed) && (
            <ClarificationPanel
              resolution={awaitingClarification ? {
                ...result.resolution,
                questions: result.resolution.questions.map((question) => ({
                  ...question, allowFreeText: false, criterionInput: undefined,
                })),
              } : result.resolution}
              onSubmit={onClarify}
              onPickAlternative={onPickAlternative}
              isSubmitting={isClarifying}
              previousAnswers={clarificationAnswers}
            />
          )}

          {!awaitingClarification && (
            <>
              {/* 건수를 먼저 보여 준다 — 사람이 먼저 확인하는 것은 몇 명이 뽑혔는가이고,
                  SQL 은 그 수가 어떻게 나왔는지 확인할 때 읽는다. */}
              {!isFailed && (
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
              )}

              {/* 실패(failureStage)면 실행되지 않았으므로 "생성된 SQL(미실행)"로, 성공이면 "실행된 SQL"로 라벨링한다. */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {result.failureStage
                      ? "생성된 SQL (검증 실패 · 미실행)"
                      : "실행된 SQL"}
                  </p>
                  <Badge variant="secondary">read-only</Badge>
                </div>
                {formattedSql ? (
                  <div className="relative">
                    <CopyButton text={formattedSql} />
                    <pre className="overflow-x-auto rounded-lg bg-foreground p-4 pr-20 text-xs leading-relaxed text-background">
                      <code className="font-mono">{formattedSql}</code>
                    </pre>
                  </div>
                ) : (
                  <p className="rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
                    SQL이 생성되지 않았습니다.
                  </p>
                )}
              </div>

              {!isFailed && visibleSegmentGroups.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleSegmentGroups.map((group) => (
                    <SegmentGroupCard key={group.title} group={group} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {outcome.kind === "failure" && (
        <FailureReasonCard result={result} reason={outcome.reason} />
      )}

      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack}>
          돌아가기
        </Button>
      </div>
    </div>
  );
}
