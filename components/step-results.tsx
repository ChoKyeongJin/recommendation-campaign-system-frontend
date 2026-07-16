"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  MousePointerClick,
  Send,
  TrendingUp,
  type LucideIcon,
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
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  CampaignExperimentVariant,
  CampaignCtrScore,
  CampaignCtrScoreSummary,
  CampaignCtrScoreValue,
  CampaignExperimentResult,
  Channel,
} from "@/lib/campaign-data";

const chartConfig = {
  ctr: { label: "클릭률 (%)", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function StepResults({
  result,
  channel,
  onBack,
  onRestart,
}: {
  result: CampaignExperimentResult;
  channel: Channel;
  onBack: () => void;
  onRestart: () => void;
}) {
  const performance = result.performance ?? [];
  const variants = result.variants ?? [];
  const analysis = result.analysis;
  const experiment = result.experiment;
  const best =
    performance.length > 0
      ? [...performance].sort((a, b) => b.ctr - a.ctr)[0]
      : null;
  const totalSent = performance[0]?.sent ?? 0;
  const totalClicks = performance.reduce((sum, p) => sum + p.clicks, 0);
  const avgCtr =
    performance.length > 0
      ? +(
          performance.reduce((s, p) => s + p.ctr, 0) / performance.length
        ).toFixed(1)
      : 0;
  const displayChannel = (experiment?.channel ?? channel).toUpperCase();
  const hasAnalysisDetails = Boolean(
    analysis?.risks?.length || analysis?.next_actions?.length,
  );

  const chartData = performance.map((p) => ({
    name: `시안 ${p.id}`,
    ctr: p.ctr,
  }));

  const skipped = result.skipped ?? [];
  const analysisTabAvailable = hasAnalysisDetails || skipped.length > 0;

  const tabs = [
    { value: "ctr", label: "클릭률 예측", available: Boolean(result.ctrScore) },
    { value: "performance", label: "성과 지표", available: true },
    { value: "variants", label: "메시지 시안", available: variants.length > 0 },
    { value: "analysis", label: "분석 요약", available: analysisTabAvailable },
  ].filter((tab) => tab.available);

  const defaultTab = tabs[0]?.value ?? "ctr";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>클릭률 분석</CardTitle>
            <Badge>{displayChannel}</Badge>
            {result.status && (
              <Badge variant="secondary">{formatStatus(result.status)}</Badge>
            )}
          </div>
          <CardDescription>
            {experiment?.experiment_name ?? "캠페인 실험"} 결과를 기준으로
            메시지 시안과 분석 상태를 보여드립니다.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTab key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTab>
          ))}
        </TabsList>

        {result.ctrScore && (
          <TabsPanel value="ctr">
            <CtrScoreCard score={result.ctrScore} />
          </TabsPanel>
        )}

        <TabsPanel value="performance">
          {performance.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  icon={Send}
                  label="총 발송"
                  value={`${totalSent.toLocaleString()}명`}
                />
                <StatCard
                  icon={MousePointerClick}
                  label="예상 총 클릭"
                  value={`${totalClicks.toLocaleString()}회`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="평균 클릭률"
                  value={`${avgCtr}%`}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    메시지 시안별 클릭률 비교
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-64 w-full">
                    <BarChart
                      accessibilityLayer
                      data={chartData}
                      margin={{ top: 24 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        unit="%"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="ctr"
                        fill="var(--color-ctr)"
                        radius={[6, 6, 0, 0]}
                      >
                        <LabelList
                          dataKey="ctr"
                          position="top"
                          className="fill-foreground text-xs"
                          formatter={(value) =>
                            typeof value === "number" ? `${value}%` : ""
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">시안별 상세 지표</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {performance.map((p) => {
                    const isBest = p.id === best?.id;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">
                            시안 {p.id}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {p.title}
                          </span>
                          {isBest && <Badge>추천</Badge>}
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="hidden sm:block">
                            <p className="text-xs text-muted-foreground">클릭</p>
                            <p className="text-sm font-medium text-foreground">
                              {p.clicks.toLocaleString()}회
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">클릭률</p>
                            <p className="text-lg font-bold text-primary">
                              {p.ctr}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">클릭률 데이터 수집 대기</CardTitle>
                <CardDescription>
                  {analysis?.summary ??
                    "아직 분석 가능한 variant 데이터가 없습니다."}
                </CardDescription>
              </CardHeader>
              <CardContent className="rounded-lg border border-dashed border-border bg-secondary p-4 text-sm text-secondary-foreground">
                선택 지표:{" "}
                {analysis?.primaryMetricUsed ?? experiment?.primary_metric ?? "ctr"}
                . 분모 이벤트가 수집되면 시안별 클릭률 차트가 표시됩니다.
              </CardContent>
            </Card>
          )}
        </TabsPanel>

        {variants.length > 0 && (
          <TabsPanel value="variants">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">메시지 시안</CardTitle>
                <CardDescription>
                  실험에 등록된 variant와 AI 분석 특성입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-3">
                {variants.map((variant, index) => (
                  <VariantCard
                    key={variant.variant_id ?? variant.variant_code ?? index}
                    variant={variant}
                    index={index}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsPanel>
        )}

        {analysisTabAvailable && (
          <TabsPanel value="analysis">
            {hasAnalysisDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">분석 요약</CardTitle>
                  <CardDescription>{analysis?.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InsightList title="리스크" items={analysis?.risks ?? []} />
                  <InsightList
                    title="다음 액션"
                    items={analysis?.next_actions ?? []}
                  />
                </CardContent>
              </Card>
            )}

            {skipped.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">스킵된 대상</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {skipped.map((item) => (
                    <Badge
                      key={`${item.userId}-${item.reason}`}
                      variant="secondary"
                    >
                      {item.userId}: {formatReason(item.reason)}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsPanel>
        )}
      </Tabs>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button onClick={onRestart} size="lg">
          새 캠페인 만들기
        </Button>
      </div>
    </div>
  );
}

function CtrScoreCard({ score }: { score: CampaignCtrScore }) {
  const variantScores = Array.isArray(score.variantScores)
    ? score.variantScores
    : [];

  if (variantScores.length > 0) {
    return <VariantCtrScoreCard score={score} variantScores={variantScores} />;
  }

  const adjustments = Array.isArray(score.adjustments) ? score.adjustments : [];
  const calibrationAdjustments = Array.isArray(score.calibrationAdjustments)
    ? score.calibrationAdjustments
    : [];
  const rows = [score.baseScore, ...adjustments, ...calibrationAdjustments].filter(
    isScoreValue,
  );
  const predictedCtr: CampaignCtrScoreValue = isScoreValue(score.predictedCtr)
    ? score.predictedCtr
    : { label: "예측 CTR", displayValue: "-" };

  if (rows.length === 0) {
    return null;
  }

  const rowValues = rows.map((row) => parsePercentDisplay(row.displayValue));
  const predictedValue = parsePercentDisplay(predictedCtr.displayValue);
  const maxValue = Math.max(...rowValues, predictedValue, 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{score.title}</CardTitle>
              {score.selectedVariantCode && (
                <Badge>시안 {score.selectedVariantCode}</Badge>
              )}
              {score.modelVersion && (
                <Badge variant="secondary">{score.modelVersion}</Badge>
              )}
            </div>
            <CardDescription>
              선택된 시안의 예측 클릭률을 구성하는 주요 요인입니다.
            </CardDescription>
          </div>
          <div className="rounded-lg bg-primary px-4 py-3 text-right text-primary-foreground">
            <p className="text-xs font-medium opacity-80">
              {predictedCtr.label}
            </p>
            <p className="text-2xl font-bold leading-none">
              {predictedCtr.displayValue}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const value = rowValues[index];
          const barWidth = Math.max((value / maxValue) * 100, 6);
          const isBaseScore = index === 0;

          return (
            <div key={`${row.label}-${row.displayValue}`} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {row.label}
                  </span>
                  {isBaseScore && <Badge variant="secondary">기준</Badge>}
                  {index > adjustments.length && (
                    <Badge variant="outline">보정</Badge>
                  )}
                </div>
                <span className="font-semibold tabular-nums text-foreground">
                  {row.displayValue}
                </span>
              </div>
              {row.reason && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {row.reason}
                </p>
              )}
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={
                    isBaseScore
                      ? "h-full rounded-full bg-muted-foreground/40"
                      : index > adjustments.length
                        ? "h-full rounded-full bg-chart-3"
                      : "h-full rounded-full bg-primary"
                  }
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function VariantCtrScoreCard({
  score,
  variantScores,
}: {
  score: CampaignCtrScore;
  variantScores: NonNullable<CampaignCtrScore["variantScores"]>;
}) {
  const sortedScores = [...variantScores].sort((a, b) => {
    if (typeof a.rank === "number" && typeof b.rank === "number") {
      return a.rank - b.rank;
    }

    return getCtrDisplayNumber(b.displayValue) - getCtrDisplayNumber(a.displayValue);
  });
  const selected =
    sortedScores.find((item) => item.isSelected) ??
    sortedScores.find((item) => item.variantCode === score.selectedVariantCode) ??
    sortedScores.find((item) => item.rank === 1) ??
    sortedScores[0];
  const maxValue = Math.max(
    ...sortedScores.map((item) => getCtrDisplayNumber(item.displayValue)),
    1,
  );
  const explanationBullets = selected?.scoreBreakdown?.explanationBullets ?? [];
  const appliedRules = (selected?.scoreBreakdown?.ruleEvaluations ?? []).filter(
    (rule) => rule.applied,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{score.title}</CardTitle>
              {selected?.variantCode && <Badge>시안 {selected.variantCode}</Badge>}
              {typeof selected?.rank === "number" && (
                <Badge variant="secondary">{selected.rank}위</Badge>
              )}
            </div>
            <CardDescription>
              CTR 스코어 API가 계산한 메시지 시안별 순위와 예측 근거입니다.
            </CardDescription>
          </div>
          {selected && (
            <div className="rounded-lg bg-primary px-4 py-3 text-right text-primary-foreground">
              <p className="text-xs font-medium opacity-80">선택 시안 CTR</p>
              <p className="text-2xl font-bold leading-none">
                {selected.displayValue}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {selected?.scoreSummary && <CtrSummaryGrid summary={selected.scoreSummary} />}

        <div className="flex flex-col gap-3">
        {sortedScores.map((item) => {
          const value = getCtrDisplayNumber(item.displayValue);
          const barWidth = Math.max((value / maxValue) * 100, 6);
          const isSelected =
            item.isSelected || item.variantCode === selected?.variantCode;

          return (
            <div key={item.variantCode} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {typeof item.rank === "number" && (
                    <Badge variant={isSelected ? "default" : "outline"}>
                      {item.rank}위
                    </Badge>
                  )}
                  <Badge variant={isSelected ? "default" : "secondary"}>
                    {item.variantCode}
                  </Badge>
                  <span className="truncate font-medium text-foreground">
                    {item.name}
                  </span>
                  {isSelected && <Badge variant="outline">선택</Badge>}
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {item.displayValue}
                </span>
              </div>
              {item.deltaVsBest?.displayValue && (
                <p className="text-xs text-muted-foreground">
                  최고 시안 대비 {item.deltaVsBest.displayValue}
                </p>
              )}
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={
                    isSelected
                      ? "h-full rounded-full bg-primary"
                      : "h-full rounded-full bg-muted-foreground/40"
                  }
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
        </div>

        {explanationBullets.length > 0 && (
          <div className="rounded-lg border border-border bg-secondary p-4">
            <h3 className="text-sm font-semibold text-secondary-foreground">
              선택 시안 산출 근거
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-secondary-foreground">
              {explanationBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {appliedRules.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              주요 적용 규칙
            </h3>
            <div className="flex flex-col gap-2">
              {appliedRules.map((rule) => (
                <div
                  key={`${rule.key}-${rule.reason}`}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">
                      {formatRuleKey(rule.key)}
                    </span>
                    {rule.appliedDelta?.displayValue && (
                      <span className="font-semibold tabular-nums text-primary">
                        {rule.appliedDelta.displayValue}
                      </span>
                    )}
                  </div>
                  {rule.reason && (
                    <p className="mt-2 text-muted-foreground">{rule.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CtrSummaryGrid({ summary }: { summary: CampaignCtrScoreSummary }) {
  const items = [
    {
      label: "적용 규칙",
      value:
        typeof summary.appliedRuleCount === "number"
          ? `${summary.appliedRuleCount}개`
          : "-",
    },
    {
      label: "미적용 규칙",
      value:
        typeof summary.notAppliedRuleCount === "number"
          ? `${summary.notAppliedRuleCount}개`
          : "-",
    },
    {
      label: "규칙 반영",
      value: summary.appliedAdjustmentTotal?.displayValue ?? "-",
    },
    {
      label: "보정값",
      value: summary.calibrationAdjustmentTotal?.displayValue ?? "-",
    },
    {
      label: "총 변화",
      value: summary.totalDeltaFromBase?.displayValue ?? "-",
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 font-semibold tabular-nums text-foreground">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function VariantCard({
  variant,
  index,
}: {
  variant: CampaignExperimentVariant;
  index: number;
}) {
  const features = variant.ai_features ?? {};
  const tags = [
    typeof features.tone === "string" ? `톤: ${formatTone(features.tone)}` : "",
    features.urgency === true ? "긴급성" : "",
    features.personalized === true ? "개인화" : "",
    features.has_price === true ? "가격/혜택" : "",
    typeof features.message_length_group === "string"
      ? `길이: ${formatLengthGroup(features.message_length_group)}`
      : "",
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge>
            {variant.variant_code ?? String.fromCharCode(65 + index)}
          </Badge>
          {variant.is_control && <Badge variant="secondary">대조군</Badge>}
        </div>
        {typeof variant.allocation_weight === "number" && (
          <span className="text-xs text-muted-foreground">
            가중치 {variant.allocation_weight}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {variant.message_name ?? `시안 ${index + 1}`}
        </h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {variant.message_body}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-lg border border-border p-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    ready_to_send: "발송 준비",
    running: "진행 중",
    completed: "완료",
  };

  return labels[value] ?? value;
}

function formatReason(value?: string) {
  const labels: Record<string, string> = {
    already_assigned: "이미 배정됨",
  };

  return value ? (labels[value] ?? value) : "-";
}

function formatTone(value: string) {
  const labels: Record<string, string> = {
    urgent: "긴급",
    personalized: "개인화",
  };

  return labels[value] ?? value;
}

function formatLengthGroup(value: string) {
  const labels: Record<string, string> = {
    short: "짧음",
    medium: "보통",
    long: "긴 편",
  };

  return labels[value] ?? value;
}

function formatRuleKey(value?: string) {
  if (!value) {
    return "적용 규칙";
  }

  const labels: Record<string, string> = {
    campaign_category_interest_match: "관심사 일치",
    high_price_sensitivity_with_price_offer: "가격 민감도",
    personalized_lifecycle_match: "라이프사이클",
    message_length_long: "메시지 길이 long",
    message_length_medium: "메시지 길이 medium",
    message_length_short: "메시지 길이 short",
    preferred_channel: "선호 채널",
    control_variant: "대조군",
  };

  return labels[value] ?? value;
}

function parsePercentDisplay(value: string) {
  const normalized = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? Math.abs(normalized) : 0;
}

function getCtrDisplayNumber(value: string) {
  return parsePercentDisplay(value);
}

function isScoreValue(value: unknown): value is CampaignCtrScoreValue {
  const record = value as Partial<CampaignCtrScoreValue> | null;

  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.label === "string" &&
    typeof record.displayValue === "string"
  );
}
