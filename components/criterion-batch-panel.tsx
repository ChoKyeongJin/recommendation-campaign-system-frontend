"use client";

import { useEffect, useState } from "react";
import type { ClarificationQuestion } from "@/lib/campaign-data";
import { buildCriterionBatch } from "@/lib/criterion-batch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CriterionBatchPanel({ questions, onPick, isSubmitting }: {
  questions: ClarificationQuestion[];
  onPick?: (query: string) => void | Promise<void>;
  isSubmitting: boolean;
}) {
  const identity = JSON.stringify(questions);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSelections({}); setError(null); }, [identity]);
  const complete = questions.every((question) => question.options.some(
    (option) => option.id === selections[question.issueId],
  ));
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">기준을 선택해 주세요</CardTitle>
        <CardDescription>입력한 조건은 유지됩니다. 필요한 기준을 모두 고른 뒤 한 번에 적용합니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {questions.map((question) => (
          <fieldset key={question.questionId} disabled={isSubmitting} className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">{question.text}</legend>
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input type="radio" name={question.issueId} value={option.id}
                    checked={selections[question.issueId] === option.id}
                    onChange={() => { setSelections((current) => ({ ...current, [question.issueId]: option.id })); setError(null); }} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{Object.keys(selections).length}/{questions.length} 선택됨</p>
          <Button type="button" disabled={!complete || isSubmitting || !onPick} onClick={() => {
            const result = buildCriterionBatch(questions, questions.map((question) => ({
              issueId: question.issueId, optionId: selections[question.issueId],
            })));
            if (result.kind === "invalid") { setError(result.message); return; }
            if (onPick) void onPick(result.query);
          }}>{isSubmitting ? "추출하는 중..." : "선택한 기준으로 추출"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
