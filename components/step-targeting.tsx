"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Check,
  Copy,
  Database,
  MessageSquareText,
  Users,
  Wrench,
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
import {
  buildReinforcementHints,
  type ReinforcementHint,
} from "@/lib/targeting-hints";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatSql } from "@/lib/sql-format";
import type { TargetingLlmAccountingEvent } from "@/lib/targeting-progress";
import type {
  ClarificationAnswer,
  TargetSegment,
  TargetSegmentGroup,
  TargetingResult,
  TargetingSupportLimit,
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
function ReinforcementHintsCard({ hints }: { hints: ReinforcementHint[] }) {
  if (hints.length === 0) {
    return null;
  }

  const hasFail = hints.some((hint) => hint.severity === "fail");

  return (
    <Card className="border-amber-300/80">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Wrench className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base">다시 시도하는 방법</CardTitle>
          <CardDescription>
            {hasFail
              ? "현재 결과를 그대로 사용할 수 없습니다. 입력에서 바로 확인할 항목입니다."
              : "일부 조건이 빠졌거나 결과가 0명입니다. 다시 조회할 때 확인해 주세요."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hints.map((hint, index) => (
          <div
            key={`${hint.severity}-${index}`}
            className="rounded-lg border border-border bg-accent p-3"
          >
            <div className="flex items-start gap-2">
              <Badge
                variant={hint.severity === "fail" ? "destructive" : "secondary"}
                className="mt-0.5 shrink-0 text-[10px]"
              >
                {hint.severity === "fail" ? "미반영" : "주의"}
              </Badge>
              <p className="text-sm font-medium text-foreground">
                {hint.symptom}
              </p>
            </div>
            <div className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[3.5rem_1fr]">
              <span className="text-xs font-semibold text-muted-foreground sm:pt-0.5">
                확인할 부분
              </span>
              <code className="break-all font-mono text-xs text-foreground">
                {hint.where}
              </code>
              <span className="text-xs font-semibold text-muted-foreground sm:pt-0.5">
                다시 입력
              </span>
              <span className="text-muted-foreground">{hint.how}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * 고쳐도 열리지 않는 실패의 안내 카드. **실패했을 때만, 백엔드가 이 블록을 만들었을 때만** 뜬다.
 *
 * 이 카드는 "다시 시도하는 방법"(ReinforcementHintsCard)과 정반대의 자리다. 저쪽은 사용자가
 * 입력을 고쳐 열 수 있는 실패의 안내이고, 이쪽은 무엇을 어떻게 다시 써도 지금은 열리지 않는
 * 실패의 안내다. 그래서 여기서는 문장 수정을 권하지 않는다 — 권하면 사용자는 같은 문장을
 * 열 번 고쳐 쓰고 같은 자리에서 막힌다.
 *
 * 문구는 전부 백엔드가 만든 것을 그대로 쓴다. 내부 분류 이름(data_not_available 등)은 응답의
 * 사용자 블록에 아예 실리지 않고, 접힌 "관리자용 정보"의 원값에만 남는다.
 */
function SupportLimitCard({
  supportLimit,
  displayedPrompt,
  developerDiagnostic,
}: {
  supportLimit: TargetingSupportLimit;
  /** 화면 위에 이미 떠 있는 프롬프트. 같으면 "이해한 요청"을 다시 적지 않는다. */
  displayedPrompt?: string;
  developerDiagnostic?: Record<string, unknown> | null;
}) {
  const understood = supportLimit.understood?.trim();
  const showUnderstood = Boolean(
    understood && understood !== displayedPrompt?.trim(),
  );
  // 구절을 짚지 못한 실패도 있다. 그때 "아래 구절"이라고 적으면 화면이 없는 목록을 가리킨다.
  const hasConditions = supportLimit.blockedConditions.length > 0;

  return (
    <Card className="border-destructive/40">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Ban className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base">{supportLimit.title}</CardTitle>
          <CardDescription>
            {hasConditions
              ? "조건은 정상적으로 이해했습니다. 아래 구절을 실행할 준비가 아직 되지 않았습니다."
              : "조건은 정상적으로 이해했습니다. 다만 이 요청을 실행할 준비가 아직 되지 않았습니다."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showUnderstood && (
          <div className="rounded-lg border border-border bg-accent p-3">
            <p className="text-xs font-medium text-muted-foreground">
              이해한 요청
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
              {understood}
            </p>
          </div>
        )}

        {hasConditions ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              실행할 수 없는 조건
            </p>
            {supportLimit.blockedConditions.map((condition, index) => (
              <div
                key={`${condition.text}-${index}`}
                className="rounded-lg border border-border bg-secondary p-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {condition.text}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {condition.reason}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // 막힌 구절을 구절 단위로 짚지 못한 실패도 있다. 그때 요청 수준의 한 문장까지
          // 감추면 카드가 제목만 남는다.
          supportLimit.reason && (
            <p className="rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
              {supportLimit.reason}
            </p>
          )
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-accent p-3">
          <div className="flex items-center gap-2">
            {!supportLimit.userCanFix && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                문장을 바꿀 필요 없음
              </Badge>
            )}
            <p className="text-xs font-medium text-muted-foreground">
              다음 행동
            </p>
          </div>
          <p className="text-sm text-foreground">{supportLimit.nextAction}</p>
          <p className="text-xs text-muted-foreground">
            이 조건이 꼭 필요하면 담당자에게 기능 지원을 요청해 주세요.
          </p>
        </div>

        {developerDiagnostic && (
          <details className="group rounded-lg border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-xs font-medium text-muted-foreground">
              <span>관리자용 정보</span>
              <span className="shrink-0 text-xs transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>
            <pre className="overflow-x-auto border-t border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
              <code className="font-mono">
                {JSON.stringify(developerDiagnostic, null, 2)}
              </code>
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/** props 기본값용 안정 참조. 리터럴을 기본값으로 쓰면 매 렌더마다 새 배열이 된다. */
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
  // 백엔드가 고친 오타 목록. 라벨 표시가 우선되면 한 음절 교정은 화면에서 묻히므로 따로 세운다.
  const typoCorrections = result.typoCorrections ?? [];
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
  // 실패·부분추출 시 어디를 보강하면 좋을지 힌트(온전히 성공하면 빈 배열).
  const reinforcementHints = buildReinforcementHints(result);
  // 되묻기가 떠 있으면 아직 조건이 확정되지 않았으므로, 답을 받기 전에는 SQL·지표·실패 안내·
  // 세그먼트를 보여 주지 않는다(패널과 ClarificationPanel 의 "확인이 필요합니다" 조건이 같다).
  const awaitingClarification = Boolean(
    result.resolution &&
      result.resolution.status !== "unsupported" &&
      (result.resolution.questions?.length ?? 0) > 0,
  );
  // 실패하면 무엇으로 돌았는지(프롬프트)와 SQL 이 만들어졌는지만 남긴다. 지표·실패 단계·세그먼트는
  // 실행되지 않은 결과라 읽을 거리가 없다.
  const isFailed = Boolean(result.failureStage || result.failureExplanation);
  // 고쳐도 열리지 않는 실패의 안내. 백엔드가 그 판정을 이미 했으므로 여기서 실패 종류를 다시
  // 분기하지 않는다 — 되묻기 중에는(아직 조건이 확정되지 않았다) 다른 패널이 자리를 갖는다.
  const supportLimit = result.failureExplanation?.supportLimit ?? null;
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
                {/* 오타 교정은 시스템이 사용자의 문장을 바꾼 것이다. 그 사실을 여기서 말하지
                    않으면 사용자는 자기가 쓴 문장과 다른 조건으로 만들어진 결과를 보게 된다. */}
                {typoCorrections.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    오타 교정:{" "}
                    {typoCorrections.map((correction) => (
                      <span
                        key={correction}
                        className="mr-2 inline-block rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
                      >
                        {correction.replace("->", "→")}
                      </span>
                    ))}
                  </p>
                )}
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
              resolution={result.resolution}
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

      {!awaitingClarification && isFailed && supportLimit && (
        <SupportLimitCard
          supportLimit={supportLimit}
          displayedPrompt={targetingPrompt}
          developerDiagnostic={result.failureExplanation?.developerDiagnostic}
        />
      )}

      {!awaitingClarification && !isFailed && (
        <ReinforcementHintsCard hints={reinforcementHints} />
      )}

      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack}>
          타겟 조건 수정
        </Button>
      </div>
    </div>
  );
}
