"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ConfidenceCondition,
  ConfidenceEvidence,
  TargetingConfidence,
} from "@/lib/campaign-data";

// 평가 축 코드 → 한글 라벨(백엔드 confidence.py AXIS_KO 와 일치).
const AXIS_LABELS: Record<string, string> = {
  request_sql_match: "요청↔SQL 일치도",
  schema_match: "스키마 일치",
  policy_similarity: "정책·기존 SQL 유사도",
  clarity: "조건 명확성",
  static_validation: "정적 검증",
};
const AXIS_ORDER = [
  "request_sql_match",
  "schema_match",
  "policy_similarity",
  "clarity",
  "static_validation",
];

// 근거 출처 유형 → 한글 라벨(어디서 확인했는지).
const SOURCE_LABELS: Record<string, string> = {
  schema: "스키마 정의",
  filter_registry: "규칙 레지스트리",
  normalization_doc: "정규화 사전",
  request_literal: "요청 문구",
  dimension_catalog: "디멘션 카탈로그",
  inference: "AI 추론",
};

function sourceLabel(sourceType: string): string {
  return SOURCE_LABELS[sourceType] ?? sourceType;
}

// 점수대별 색(높음 emerald / 보통 amber / 낮음 rose).
function scoreTone(score: number): {
  text: string;
  bg: string;
  bar: string;
} {
  if (score >= 85) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      bar: "bg-emerald-500",
    };
  }
  if (score >= 65) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      bar: "bg-amber-500",
    };
  }
  return {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    bar: "bg-rose-500",
  };
}

function DimensionRow({ axisKey, value }: { axisKey: string; value: number }) {
  const tone = scoreTone(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">
          {AXIS_LABELS[axisKey] ?? axisKey}
        </span>
        <span className={`shrink-0 font-mono font-semibold ${tone.text}`}>
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.max(Math.min(value, 100), 0)}%` }}
        />
      </div>
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: ConfidenceEvidence }) {
  const confirmed = evidence.kind === "confirmed";
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      <Badge
        variant="outline"
        className={`mt-px shrink-0 gap-1 text-[9px] font-normal ${
          confirmed
            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            : "border-amber-500/40 text-amber-600 dark:text-amber-400"
        }`}
      >
        {confirmed ? (
          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
        ) : (
          <Info className="h-2.5 w-2.5" aria-hidden />
        )}
        {confirmed ? "확인" : "추론"}
      </Badge>
      <span className="min-w-0 break-words text-muted-foreground">
        <span className="font-medium text-foreground">
          {sourceLabel(evidence.source_type)}
        </span>{" "}
        · <code className="font-mono text-[11px]">{evidence.ref}</code>
        {evidence.detail ? ` — ${evidence.detail}` : ""}
      </span>
    </li>
  );
}

function ConditionCard({ condition }: { condition: ConfidenceCondition }) {
  const tone = scoreTone(condition.score);
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 break-words text-sm font-medium text-foreground">
            {condition.ko_label}
          </span>
          <Badge
            variant="outline"
            className={`shrink-0 text-[9px] font-normal ${
              condition.verified
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/40 text-amber-600 dark:text-amber-400"
            }`}
          >
            {condition.verified ? "✓ 확인됨" : "△ 추론"}
          </Badge>
        </div>
        <span className={`shrink-0 font-mono text-sm font-bold ${tone.text}`}>
          {condition.score}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
            점
          </span>
        </span>
      </div>

      {condition.evidence.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5 border-l-2 border-border pl-3">
          {condition.evidence.map((evidence, index) => (
            <EvidenceRow key={index} evidence={evidence} />
          ))}
        </ul>
      )}

      {condition.warnings.map((warning, index) => (
        <div
          key={index}
          className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{warning}</span>
        </div>
      ))}
    </div>
  );
}

export function ConfidenceCard({
  confidence,
}: {
  confidence: TargetingConfidence;
}) {
  const tone = scoreTone(confidence.overall_score);
  const dimensionKeys = [
    ...AXIS_ORDER.filter((key) => key in confidence.dimensions),
    ...Object.keys(confidence.dimensions).filter(
      (key) => !AXIS_ORDER.includes(key),
    ),
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-base">타겟팅 신뢰도</CardTitle>
        </div>
        <CardDescription>
          생성된 SQL의 각 조건을 스키마·정책 문서와 대조해 산정한 점수와 근거입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* 전체 신뢰도 */}
        <div
          className={`flex items-center gap-4 rounded-lg border border-border p-4 ${tone.bg}`}
        >
          <div className="flex flex-col items-center">
            <span className={`font-sans text-4xl font-bold ${tone.text}`}>
              {confidence.overall_score}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              / 100점
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">신뢰도 수준</span>
              <Badge
                className={`text-xs font-semibold ${tone.text} ${tone.bg} border-transparent`}
                variant="outline"
              >
                {confidence.level}
              </Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${tone.bar}`}
                style={{
                  width: `${Math.max(Math.min(confidence.overall_score, 100), 0)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* 평가 축별 점수 */}
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-medium text-muted-foreground">평가 축</p>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {dimensionKeys.map((key) => (
              <DimensionRow
                key={key}
                axisKey={key}
                value={confidence.dimensions[key]}
              />
            ))}
          </div>
        </div>

        {/* 조건별 신뢰도·근거 */}
        {confidence.conditions.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              조건별 신뢰도·근거
            </p>
            <div className="flex flex-col gap-2.5">
              {confidence.conditions.map((condition, index) => (
                <ConditionCard key={`${condition.key}-${index}`} condition={condition} />
              ))}
            </div>
          </div>
        )}

        {/* 전체 경고 */}
        {confidence.warnings.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              전체 경고
            </div>
            <ul className="flex flex-col gap-1">
              {confidence.warnings.map((warning, index) => (
                <li
                  key={index}
                  className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground"
                >
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-500"
                    aria-hidden
                  />
                  <span className="min-w-0 break-words">{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
