"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, Thermometer } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CampaignMessage, Channel } from "@/lib/campaign-data";
import { cn } from "@/lib/utils";

const POLICY_NAME = "message-generation-policy";
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const TEMPERATURE_STEP = 0.1;
const DEFAULT_TEMPERATURE = 0.7;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** GET 응답의 다양한 래핑({content}, {policy:{content}}, 혹은 bare)을 흡수해 content를 뽑는다. */
function extractContent(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) {
    return {};
  }
  if (isPlainObject(data.content)) {
    return data.content;
  }
  if (isPlainObject(data.policy) && isPlainObject(data.policy.content)) {
    return data.policy.content;
  }
  if (typeof data.temperature === "number") {
    return data;
  }
  return {};
}

/** FastAPI가 돌려주는 detail(문자열/검증 배열)을 사람이 읽을 문구로 정리한다. */
function extractDetail(data: unknown): string {
  if (isPlainObject(data) && "detail" in data) {
    const detail = data.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          isPlainObject(item) && "msg" in item
            ? String(item.msg)
            : JSON.stringify(item),
        )
        .join(", ");
    }
  }
  return "";
}

function clampTemperature(value: number) {
  return Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, value));
}

export function StepMessages({
  messages,
  channel,
  onBack,
  onNext,
  isNextLoading = false,
  nextError,
  onRegenerate,
  isRegenerating = false,
  regenerateError,
}: {
  messages: CampaignMessage[];
  channel: Channel;
  onBack: () => void;
  onNext: () => void;
  isNextLoading?: boolean;
  nextError?: string | null;
  onRegenerate?: () => void | Promise<void>;
  isRegenerating?: boolean;
  regenerateError?: string | null;
}) {
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  // temperature 외 다른 정책 키를 저장 시 덮어쓰지 않도록 보존한다.
  const [loadedContent, setLoadedContent] = useState<Record<string, unknown>>(
    {},
  );
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPolicy = async () => {
      try {
        const response = await fetch(`/api/policies/${POLICY_NAME}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            extractDetail(data) || "메시지 생성 정책을 불러오지 못했습니다.",
          );
        }
        if (cancelled) {
          return;
        }
        const content = extractContent(data);
        setLoadedContent(content);
        const current = content.temperature;
        if (typeof current === "number" && Number.isFinite(current)) {
          setTemperature(clampTemperature(current));
        }
      } catch (error) {
        if (!cancelled) {
          setPolicyError(
            error instanceof Error
              ? error.message
              : "메시지 생성 정책을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPolicy(false);
        }
      }
    };

    void loadPolicy();
    return () => {
      cancelled = true;
    };
  }, []);

  // temperature를 저장(PUT)하고 실행 서버에 적용(reload)한다.
  const persistTemperature = useCallback(async () => {
    const content = { ...loadedContent, temperature };

    const putResponse = await fetch(`/api/policies/${POLICY_NAME}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const putData = await putResponse.json().catch(() => null);
    if (!putResponse.ok) {
      throw new Error(
        extractDetail(putData) || "temperature 저장에 실패했습니다.",
      );
    }
    setLoadedContent(content);

    const reloadResponse = await fetch("/api/policies/reload", {
      method: "POST",
    });
    if (!reloadResponse.ok) {
      const reloadData = await reloadResponse.json().catch(() => null);
      throw new Error(
        extractDetail(reloadData) || "temperature 적용(리로드)에 실패했습니다.",
      );
    }
  }, [loadedContent, temperature]);

  const busy = isSavingPolicy || isRegenerating;

  const handleRegenerate = async () => {
    if (busy || !onRegenerate) {
      return;
    }
    setPolicyError(null);
    setIsSavingPolicy(true);
    try {
      await persistTemperature();
    } catch (error) {
      setPolicyError(
        error instanceof Error
          ? error.message
          : "temperature 저장에 실패했습니다.",
      );
      setIsSavingPolicy(false);
      return;
    }
    setIsSavingPolicy(false);
    await onRegenerate();
  };

  const regenerateLabel = isSavingPolicy
    ? "설정 저장 중..."
    : isRegenerating
      ? "재생성 중..."
      : "메시지 재생성";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>메시지 추천</CardTitle>
            <Badge>{channel}</Badge>
          </div>
          <CardDescription>
            선택한 채널에 최적화된 메시지 3가지를 추천해 드립니다. 각 메시지는
            서로 다른 소구점을 사용합니다.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Thermometer
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">
                  창의성 (temperature)
                </span>
              </div>
              <Badge variant="secondary" className="font-mono tabular-nums">
                {temperature.toFixed(1)}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-8 text-right text-xs text-muted-foreground">
                {TEMPERATURE_MIN.toFixed(1)}
              </span>
              <input
                type="range"
                aria-label="temperature"
                className="flex-1 accent-primary disabled:opacity-50"
                min={TEMPERATURE_MIN}
                max={TEMPERATURE_MAX}
                step={TEMPERATURE_STEP}
                value={temperature}
                disabled={isLoadingPolicy || busy}
                onChange={(event) =>
                  setTemperature(clampTemperature(Number(event.target.value)))
                }
              />
              <span className="w-8 text-xs text-muted-foreground">
                {TEMPERATURE_MAX.toFixed(1)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {isLoadingPolicy
                  ? "현재 정책 값을 불러오는 중…"
                  : "값이 낮으면 안정적이고, 높으면 다양하고 창의적인 문구가 생성됩니다."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isLoadingPolicy || busy || !onRegenerate}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                {regenerateLabel}
              </Button>
            </div>

            {(policyError || regenerateError) && (
              <p className="text-xs font-medium text-destructive">
                {policyError ?? regenerateError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isRegenerating ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-xl bg-muted/60"
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
          <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            추천 메시지가 없습니다. temperature를 조절하고 [메시지 재생성]을
            눌러보세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {messages.map((m) => (
            <Card key={m.id} className="flex flex-col">
              <CardHeader className="gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    시안 {m.id}
                  </span>
                  <Badge variant="secondary">{m.tone}</Badge>
                </div>
                <CardTitle className="text-base">{m.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="rounded-lg border border-border bg-secondary p-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">
                    {m.body}
                  </p>
                  {channel === "RCS" && m.buttons && m.buttons.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {m.buttons.map((button) => (
                        <div key={`${m.id}-${button.name}`}>
                          {button.url ? (
                            <a
                              href={button.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                }),
                                "border-primary/30 bg-background text-primary hover:bg-primary/10 hover:text-primary",
                              )}
                            >
                              {button.name}
                            </a>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-primary/30 bg-background text-primary hover:bg-primary/10 hover:text-primary"
                            >
                              {button.name}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button
          onClick={onNext}
          size="lg"
          disabled={isNextLoading || busy || messages.length === 0}
        >
          {isNextLoading ? "클릭률 예측 중..." : "클릭률 예측 보기"}
        </Button>
      </div>

      {nextError && (
        <p className="text-right text-sm font-medium text-destructive">
          {nextError}
        </p>
      )}
    </div>
  );
}
