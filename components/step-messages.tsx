"use client";

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

export function StepMessages({
  messages,
  channel,
  onBack,
  onNext,
  isNextLoading = false,
  nextError,
}: {
  messages: CampaignMessage[];
  channel: Channel;
  onBack: () => void;
  onNext: () => void;
  isNextLoading?: boolean;
  nextError?: string | null;
}) {
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
      </Card>

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

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button onClick={onNext} size="lg" disabled={isNextLoading}>
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
