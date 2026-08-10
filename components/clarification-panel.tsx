"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, Info, Lock, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
  ResolutionAssumption,
  TargetingResolution,
} from "@/lib/campaign-data";

/**
 * 확정 계층(Resolution) 패널.
 *
 * 세 가지를 한 자리에서 보여준다.
 *
 *   질문   결과가 크게 달라지는 모호성 — 답해야 SQL 이 나간다.
 *   가정   사용자가 말하지 않았지만 정책이 채운 값 — 답한 것과 구분해서 보여준다.
 *   미지원 사용자가 답해도 열리지 않는 조건 — 입력을 요구하지 않는다.
 *
 * 답은 원문에 이어 붙이지 않는다. issueId 를 그대로 백엔드에 돌려주면 백엔드가 그 결핍이
 * 가리키는 의미 슬롯 하나만 고친다 — 나머지 조건(기간·금액·사건)은 그대로 유지된다.
 *
 * 답했는데도 같은 결핍을 또 물어 오는 경우(백엔드가 그 값으로 대상을 특정하지 못함)가 있다.
 * 이때 화면에 답한 흔적이 없으면 "내 답이 사라졌다"로 읽힌다. 그래서 직전 라운드의 답을
 * previousAnswers 로 받아 (1) 다시 물어온 항목은 그 값을 채워 주고 "이 값으로는 확정하지
 * 못했다"고 알리고, (2) 다시 묻지 않는 항목은 이미 반영된 답으로 따로 보여준다.
 */

const NO_ANSWERS: ClarificationAnswer[] = [];

/** 가정의 출처를 사람이 읽는 말로. 정책이 고른 값과 사용자가 고른 값은 다른 사실이다. */
const PROVENANCE_LABELS: Record<string, string> = {
  policy_default: "기본값 적용",
  semantic_inference: "문장에서 추론",
  user_clarification: "직접 선택",
  user_explicit: "직접 입력",
};

function formatAssumptionValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // 롤링 창({type:"rolling", value:30, unit:"day"})은 가장 흔한 가정이라 따로 읽어 준다.
    if (record.type === "rolling" && typeof record.value === "number") {
      const units: Record<string, string> = {
        day: "일",
        week: "주",
        month: "개월",
        year: "년",
      };
      const unit = units[String(record.unit)] ?? String(record.unit ?? "");
      return `최근 ${record.value}${unit}`;
    }
  }
  return JSON.stringify(value);
}

/** 백엔드 엔티티 타입(product 등)을 화면 문구로. 매핑이 없으면 원값을 그대로 쓴다. */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "상품",
  brand: "브랜드",
  category: "카테고리",
  campaign: "캠페인",
  channel: "채널",
  region: "지역",
  grade: "등급",
  segment: "세그먼트",
};

function entityTypeLabel(entityType?: string | null) {
  if (!entityType) {
    return "";
  }
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

/** 답 하나를 사람이 읽는 값으로. 선택지 질문은 라벨, 자유 입력은 입력값. */
function answerDisplayValue(answer: ClarificationAnswer): string {
  return (answer.optionLabel ?? answer.text ?? answer.optionId ?? "").trim();
}

/** 이번 질문이 직전 라운드에 답한 결핍과 같은 것인지 — 슬롯이 같으면 같은 결핍이다. */
function findPreviousAnswer(
  question: ClarificationQuestion,
  previousAnswers: ClarificationAnswer[],
): ClarificationAnswer | undefined {
  const slot = question.slot?.trim();
  return previousAnswers.find((answer) => {
    if (!answerDisplayValue(answer)) {
      return false;
    }
    return slot && answer.slot?.trim()
      ? answer.slot.trim() === slot
      : answer.issueId === question.issueId;
  });
}

/** 다시 묻지 않은(=반영된) 직전 답변들. 답이 사라지지 않았음을 보여 준다. */
function AnsweredList({ answers }: { answers: ClarificationAnswer[] }) {
  if (answers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/60 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-xs font-medium text-foreground">
          앞서 답해 주신 내용은 그대로 반영했습니다
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {answers.map((answer) => (
          <li
            key={answer.issueId}
            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            {answer.questionText && (
              <span className="text-foreground">
                &lsquo;{answer.questionText}&rsquo;
              </span>
            )}
            <span className="font-medium text-foreground">
              {answerDisplayValue(answer)}
            </span>
            {answer.slot && (
              <span className="text-[11px] text-muted-foreground/80">
                ({answer.slot})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssumptionList({ assumptions }: { assumptions: ResolutionAssumption[] }) {
  if (assumptions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/60 p-3">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
        <p className="text-xs font-medium text-foreground">
          이 조건은 시스템이 확정했습니다
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {assumptions.map((assumption) => (
          <li
            key={`${assumption.code}:${assumption.slot}`}
            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <Badge variant="secondary" className="font-normal">
              {PROVENANCE_LABELS[assumption.provenance] ?? assumption.provenance}
            </Badge>
            {assumption.evidenceText && (
              <span className="text-foreground">
                &lsquo;{assumption.evidenceText}&rsquo;
              </span>
            )}
            <span className="font-medium text-foreground">
              {formatAssumptionValue(assumption.value)}
            </span>
            <span className="text-[11px] text-muted-foreground/80">
              ({assumption.slot})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  answer,
  onChange,
  disabled,
  previousValue,
}: {
  question: ClarificationQuestion;
  index: number;
  answer: ClarificationAnswer | undefined;
  onChange: (next: ClarificationAnswer) => void;
  disabled: boolean;
  /** 직전 라운드에 이 결핍(같은 슬롯)에 답한 값. 있으면 재질문이다. */
  previousValue?: string;
}) {
  const name = `clarification-${question.questionId}`;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        previousValue ? "border-amber-300/80 bg-amber-50/40" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{question.text}</p>
          {question.evidenceText && (
            <p className="mt-1 text-xs text-muted-foreground">
              원문: &lsquo;{question.evidenceText}&rsquo;
            </p>
          )}
        </div>
      </div>

      {/* 재질문. 답이 무시된 게 아니라 그 값으로 대상을 특정하지 못했다는 사실을 알린다. */}
      {previousValue && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-100/50 p-2.5">
          <RotateCcw
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-amber-900">
            직전에 <b>&lsquo;{previousValue}&rsquo;</b> 로 답해 주셨지만, 그 값으로는
            대상을 하나로 특정하지 못했습니다. 아래 값을 실제 등록된
            {entityTypeLabel(question.entityType)
              ? ` ${entityTypeLabel(question.entityType)}명`
              : " 값"}
            으로 정확히 바꿔 주세요.
          </p>
        </div>
      )}

      {question.options.length > 0 ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const checked = answer?.optionId === option.id;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                  checked
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={option.id}
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      issueId: question.issueId,
                      optionId: option.id,
                      optionLabel: option.label,
                      slot: question.slot,
                      questionText: question.text,
                    })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={answer?.text ?? ""}
          disabled={disabled}
          placeholder={
            question.entityType
              ? `${entityTypeLabel(question.entityType)} 이름을 정확히 입력하세요`
              : "값을 입력하세요"
          }
          onChange={(event) =>
            onChange({
              issueId: question.issueId,
              text: event.target.value,
              slot: question.slot,
              questionText: question.text,
            })
          }
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      )}
    </div>
  );
}

export function ClarificationPanel({
  resolution,
  onSubmit,
  isSubmitting = false,
  previousAnswers = NO_ANSWERS,
}: {
  resolution: TargetingResolution;
  /** 답을 모아 타겟팅을 다시 실행한다. 프롬프트는 그대로다. */
  onSubmit?: (answers: ClarificationAnswer[]) => void | Promise<void>;
  isSubmitting?: boolean;
  /** 직전 라운드까지 사용자가 답한 값들 (재질문 판별·이력 표시용). */
  previousAnswers?: ClarificationAnswer[];
}) {
  const questions = useMemo(
    () => resolution.questions ?? [],
    [resolution.questions],
  );
  const [answers, setAnswers] = useState<Record<string, ClarificationAnswer>>({});

  // 이번 라운드 질문 ↔ 직전 답 매칭. 슬롯이 같으면 같은 결핍을 다시 묻는 것이다.
  const previousByIssueId = useMemo(() => {
    const map = new Map<string, ClarificationAnswer>();
    for (const question of questions) {
      const previous = findPreviousAnswer(question, previousAnswers);
      if (previous) {
        map.set(question.issueId, previous);
      }
    }
    return map;
  }, [questions, previousAnswers]);

  // 다시 묻지 않은 답 = 백엔드가 받아들인 답. 사라지지 않았음을 따로 보여 준다.
  const settledAnswers = useMemo(() => {
    const reAsked = new Set(
      [...previousByIssueId.values()].map((answer) => answer.issueId),
    );
    return previousAnswers.filter(
      (answer) => answerDisplayValue(answer) && !reAsked.has(answer.issueId),
    );
  }, [previousAnswers, previousByIssueId]);

  // 질문 묶음이 바뀌면(새 프롬프트·다음 라운드) 입력 상태를 새로 만든다. 다만 같은 결핍을
  // 다시 물어온 항목은 직전 답을 채워 둔다 — 빈 칸으로 되돌리면 답이 삼켜진 것처럼 보인다.
  const questionKey = questions.map((question) => question.issueId).join("|");
  useEffect(() => {
    const seeded: Record<string, ClarificationAnswer> = {};

    for (const question of questions) {
      const previous = previousByIssueId.get(question.issueId);
      if (!previous) {
        continue;
      }

      if (question.options.length > 0) {
        // 선택지 id 는 라운드마다 달라질 수 있어, 이번 선택지에 남아 있는 값만 되살린다.
        const option = question.options.find(
          (candidate) =>
            candidate.id === previous.optionId ||
            candidate.label === previous.optionLabel,
        );
        if (option) {
          seeded[question.issueId] = {
            issueId: question.issueId,
            optionId: option.id,
            optionLabel: option.label,
            slot: question.slot,
            questionText: question.text,
          };
        }
        continue;
      }

      const text = (previous.text ?? "").trim();
      if (text) {
        seeded[question.issueId] = {
          issueId: question.issueId,
          text,
          slot: question.slot,
          questionText: question.text,
        };
      }
    }

    setAnswers(seeded);
    // questionKey 로 라운드 전환을 감지한다(같은 라운드에서 리렌더될 때 입력이 날아가면 안 된다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey]);

  const answered = useMemo(
    () =>
      questions.filter((question) => {
        const answer = answers[question.issueId];
        if (!answer) {
          return false;
        }
        return question.options.length > 0
          ? Boolean(answer.optionId)
          : Boolean(answer.text?.trim());
      }).length,
    [answers, questions],
  );

  if (resolution.status === "unsupported") {
    const unsupported = resolution.unsupported ?? [];
    if (unsupported.length === 0) {
      return null;
    }
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-destructive" aria-hidden />
            지원하지 않는 조건
          </CardTitle>
          <CardDescription>
            추가로 설명해 주셔도 이 조건은 현재 실행 자산으로 만들 수 없습니다. 조건을
            바꾸거나 나눠서 요청해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {unsupported.map((issue, index) => (
            <p
              key={`${issue.kind}-${index}`}
              className="rounded-lg border border-border bg-secondary p-3 text-sm text-secondary-foreground"
            >
              {issue.message}
              {issue.evidenceText && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (원문: &lsquo;{issue.evidenceText}&rsquo;)
                </span>
              )}
            </p>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    // 질문이 없으면 확정된 요청이다. 정책이 채운 값 또는 사용자가 답한 값이 있을 때만 알린다.
    if (resolution.assumptions.length === 0 && settledAnswers.length === 0) {
      return null;
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
            조건 확정
          </CardTitle>
          <CardDescription>
            {settledAnswers.length > 0
              ? "답해 주신 값으로 조건을 확정해 타겟을 추출했습니다."
              : "말씀하지 않은 값 일부를 운영 정책으로 채워 타겟을 추출했습니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <AnsweredList answers={settledAnswers} />
          <AssumptionList assumptions={resolution.assumptions} />
        </CardContent>
      </Card>
    );
  }

  const canSubmit = answered > 0 && !isSubmitting;

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-primary" aria-hidden />
          확인이 필요합니다
        </CardTitle>
        <CardDescription>
          {previousByIssueId.size > 0
            ? "답해 주신 값으로는 아직 조건을 확정하지 못했습니다. 아래 항목만 다시 확인해 주시면 그 조건만 고쳐 다시 추출합니다 — 나머지 조건은 그대로 유지됩니다."
            : "아래 항목은 어떻게 읽느냐에 따라 추출되는 고객이 크게 달라집니다. 선택해 주시면 그 조건만 확정해 다시 추출합니다 — 나머지 조건은 그대로 유지됩니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AnsweredList answers={settledAnswers} />
        <AssumptionList assumptions={resolution.assumptions} />

        <div className="flex flex-col gap-3">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.questionId}
              question={question}
              index={index}
              answer={answers[question.issueId]}
              disabled={isSubmitting}
              previousValue={
                previousByIssueId.has(question.issueId)
                  ? answerDisplayValue(previousByIssueId.get(question.issueId)!)
                  : undefined
              }
              onChange={(next) =>
                setAnswers((current) => ({ ...current, [next.issueId]: next }))
              }
            />
          ))}
        </div>

        {(resolution.deferredQuestionCount ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            확인할 항목이 {resolution.deferredQuestionCount}개 더 있습니다. 위 항목을
            먼저 확정하면 이어서 여쭤봅니다.
          </p>
        )}

        {onSubmit && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {answered}/{questions.length} 선택됨
            </p>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() =>
                onSubmit(
                  Object.values(answers)
                    .map((answer) => ({
                      ...answer,
                      ...(answer.text ? { text: answer.text.trim() } : {}),
                    }))
                    .filter((answer) => answer.optionId || answer.text),
                )
              }
            >
              {isSubmitting ? "다시 추출하는 중..." : "이 조건으로 다시 추출"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
