"use client";

import { useState } from "react";
import {
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
import {
  buildReinforcementHints,
  type ReinforcementHint,
} from "@/lib/targeting-hints";
import { copyTextToClipboard } from "@/lib/clipboard";
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

/** props 기본값용 안정 참조. 리터럴을 기본값으로 쓰면 매 렌더마다 새 배열이 된다. */
const NO_CLARIFICATION_ANSWERS: ClarificationAnswer[] = [];

export function StepTargeting({
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
  /** 되묻기 답을 모아 다시 추출한다(프롬프트는 그대로). */
  onClarify?: (answers: ClarificationAnswer[]) => void | Promise<void>;
  /** 보기 문장을 골랐다 — 프롬프트를 그 문장으로 바꿔 다시 추출한다. */
  onPickAlternative?: (query: string) => void | Promise<void>;
  isClarifying?: boolean;
  clarificationAnswers?: ClarificationAnswer[];
}) {
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
                {result.sql ? (
                  <div className="relative">
                    <CopyButton text={result.sql} />
                    <pre className="overflow-x-auto rounded-lg bg-foreground p-4 pr-20 text-xs leading-relaxed text-background">
                      <code className="font-mono">{result.sql}</code>
                    </pre>
                  </div>
                ) : (
                  <p className="rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
                    SQL이 생성되지 않았습니다.
                  </p>
                )}
              </div>

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

              {!isFailed && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">
                      세그먼트 구성
                    </p>
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
              )}
            </>
          )}
        </CardContent>
      </Card>

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
