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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  CampaignExperimentVariant,
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Send}
          label="실험 ID"
          value={result.experimentId ? `#${result.experimentId}` : "-"}
        />
        <StatCard
          icon={MousePointerClick}
          label="배정 / 스킵"
          value={`${(result.createdAssignmentCount ?? 0).toLocaleString()} / ${(result.skippedAssignmentCount ?? 0).toLocaleString()}`}
        />
        <StatCard
          icon={TrendingUp}
          label="분석 신뢰도"
          value={formatConfidence(analysis?.confidence)}
        />
      </div>

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
                      formatter={(v: number) => `${v}%`}
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

      {result.skipped && result.skipped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">스킵된 대상</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {result.skipped.map((item) => (
              <Badge key={`${item.userId}-${item.reason}`} variant="secondary">
                {item.userId}: {formatReason(item.reason)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

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

function formatConfidence(value?: string) {
  const labels: Record<string, string> = {
    low: "낮음",
    medium: "보통",
    high: "높음",
  };

  return value ? (labels[value] ?? value) : "-";
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
