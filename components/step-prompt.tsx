"use client";

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

const EXAMPLES = [
  "2026년 2월보다 3월 구매금액이 감소한 고객 리스트를 추출해줘",
  "2026년 1월, 2월, 3월에 모두 구매한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 10개 상품 중 하나 이상을 구매한 고객 리스트를 추출해줘",
  "2026년 2월보다 3월 구매금액이 감소한 고객 리스트를 추출해줘",
  "2026년 3월 판매량 상위 5개 상품 중 하나 이상을 구매한 고객 리스트를 추출해줘",
  "30대 여성 고객 중 재구매 가능성이 낮은 고객 리스트를 추출해줘",
  "2026년 3월 구매 고객 중 구매금액이 높은 고객 리스트를 추출해줘",
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
  error,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onExtract: () => void;
  isExtracting: boolean;
  error: string | null;
}) {
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
