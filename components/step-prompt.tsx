"use client";

import { MessageSquareText, Radio } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/campaign-data";

const EXAMPLES = [
  "2026년 2월보다 3월 구매금액이 감소한 고객 리스트를 추출해줘",
  "2026년 1월, 2월, 3월에 모두 구매한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품 중 하나 이상을 구매한 고객 리스트를 추출해줘",
  "2026년 2월보다 3월 구매금액이 감소한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 5개 상품 중 하나 이상을 구매한 고객 리스트를 추출해줘",
  "30대 여성 고객 중 재구매 가능성이 낮은 고객 리스트를 추출해줘",
  "2026년 3월 구매 고객 중 구매금액이 높은 고객 리스트를 추출해줘",
  "2026년에 전환율이 높은 캠페인 상위 3개에 참여한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품을 구매하지 않았지만 같은 카테고리 상품을 구매한 고객 리스트를 추출해줘",
  "불만 접수 또는 부정적인 피드백이 많은 VIP 고객 리스트를 추출해줘",
  "2026년 2월 또는 3월에 진행된 캠페인에 참여했지만 구매까지 전환되지 않은 고객 리스트를 추출해줘",
];

const CHANNELS: {
  value: Channel;
  title: string;
  desc: string;
  icon: typeof Radio;
}[] = [
  {
    value: "LMS",
    title: "LMS",
    desc: "장문 문자 메시지 (텍스트 중심)",
    icon: MessageSquareText,
  },
  {
    value: "RCS",
    title: "RCS",
    desc: "리치 메시지 (버튼·이미지 지원)",
    icon: Radio,
  },
];

export function StepPrompt({
  prompt,
  setPrompt,
  channel,
  setChannel,
  onAnalyze,
  isAnalyzing,
  error,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  channel: Channel;
  setChannel: (c: Channel) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>캠페인 목표를 입력하세요</CardTitle>
        <CardDescription>
          원하는 캠페인 목표를 자연어로 설명하면 타겟 고객과 메시지를 자동으로
          추천해 드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prompt">프롬프트</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예) 장바구니를 남겨둔 고객에게 할인 쿠폰으로 구매를 유도하고 싶어요"
            className="min-h-32 resize-none"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {EXAMPLES.map((ex, index) => (
              <button
                key={`${index}-${ex}`}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-left text-xs text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>발송 채널</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              const selected = channel === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannel(c.value)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      {c.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button
            onClick={onAnalyze}
            disabled={!prompt.trim() || isAnalyzing}
            size="lg"
          >
            {isAnalyzing ? "타겟팅 분석 중..." : "타겟팅 분석하기"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
