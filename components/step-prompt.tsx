"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, LoaderCircle, XCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { TargetingProgressState } from "@/lib/targeting-progress";

const EXAMPLES = [
  "2026년 2월보다 3월 구매금액이 감소한 고객 리스트를 추출해줘",
  "2026년 1월, 2월, 3월에 모두 구매한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품 중 하나 이상을 구매한 고객 리스트를 추출해줘",
  "2026년 캠페인 참여 고객 중 최근 90일간 구매하지 않은 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품을 구매하지 않았지만 같은 카테고리 상품을 구매한 고객 리스트를 추출해줘",
  "불만 접수 또는 부정적인 피드백이 많은 VIP 고객 리스트를 추출해줘",
  "2026년 2월 또는 3월에 진행된 캠페인에 참여했지만 구매까지 전환되지 않은 고객 리스트를 추출해줘",
];

export function StepPrompt({
  prompt,
  setPrompt,
  onExtract,
  isExtracting,
  progress,
  error,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onExtract: () => void;
  isExtracting: boolean;
  progress: TargetingProgressState;
  error: string | null;
}) {
  const [clientElapsedMs, setClientElapsedMs] = useState(0);
  useEffect(() => {
    if (!isExtracting) return;
    const startedAt = Date.now();
    setClientElapsedMs(0);
    const timer = window.setInterval(
      () => setClientElapsedMs(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [isExtracting]);
  const reportedElapsedMs = progress.stages.reduce(
    (maximum, stage) => Math.max(maximum, stage.elapsed_ms),
    0,
  );
  const elapsedSeconds = Math.floor(
    Math.max(clientElapsedMs, reportedElapsedMs) / 1000,
  );
  const activeStage = progress.stages.find(
    (stage) => stage.status === "started",
  );
  const failedStage = progress.stages.find(
    (stage) => stage.status === "failed",
  );
  const showProgress = isExtracting || Boolean(error && failedStage);

  return (
    <Card>
      <CardHeader>
        <CardTitle>캠페인 목표를 입력하세요</CardTitle>
        <CardDescription>
          원하는 고객 조건을 자연어로 설명하면 검증된 타겟 SQL과 오디언스를
          제공합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prompt">프롬프트</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isExtracting}
            placeholder="예) 장바구니를 남겨둔 고객에게 할인 쿠폰으로 구매를 유도하고 싶어요"
            className="min-h-32 resize-none"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {EXAMPLES.map((ex, index) => (
              <button
                key={`${index}-${ex}`}
                type="button"
                onClick={() => setPrompt(ex)}
                disabled={isExtracting}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-left text-xs text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {showProgress && (
          <section
            className="rounded-lg border border-border bg-muted/40 p-4"
            aria-label="타겟 추출 진행 상황"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {failedStage
                  ? "타겟 추출 과정에서 문제가 발생했습니다"
                  : "타겟 추출 과정을 진행하고 있습니다"}
              </p>
              <div
                className="flex items-center gap-2 tabular-nums text-xs text-muted-foreground"
                aria-hidden
              >
                {activeStage && (
                  <span>
                    {activeStage.order}/{activeStage.total} 단계
                  </span>
                )}
                <span>{elapsedSeconds}초 경과</span>
              </div>
            </div>
            {progress.stages.length === 0 ? (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                서버에 요청을 전달하고 있습니다.
              </div>
            ) : (
              <ol className="flex flex-col gap-3">
                {progress.stages.map((stage) => {
                  const Icon = stage.status === "completed"
                    ? CheckCircle2
                    : stage.status === "failed"
                      ? XCircle
                      : LoaderCircle;
                  return (
                    <li key={stage.stage} className="flex items-start gap-2.5">
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${stage.status === "started" ? "animate-spin text-primary" : stage.status === "failed" ? "text-destructive" : "text-emerald-600"}`}
                        aria-hidden
                      />
                      <div>
                        <p
                          className="text-sm font-medium"
                          {...(stage.status === "started"
                            ? {
                                role: "status",
                                "aria-live": "polite" as const,
                              }
                            : stage.status === "failed"
                              ? {
                                  role: "alert",
                                }
                              : {})}
                        >
                          {stage.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stage.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
                {isExtracting &&
                  progress.stages.length < (progress.stages[0]?.total ?? 0) && (
                    <li className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <Circle className="h-4 w-4" aria-hidden /> 다음 단계를 기다리는 중
                    </li>
                  )}
              </ol>
            )}
          </section>
        )}

        <div className="flex justify-end">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button
            onClick={onExtract}
            disabled={!prompt.trim() || isExtracting}
            size="lg"
          >
            {isExtracting ? "타겟 추출 중..." : "타겟 추출하기"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
