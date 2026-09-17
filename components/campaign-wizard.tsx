"use client";

import { useState } from "react";
import { Database, FileText, Sparkles } from "lucide-react";
import { SettingsMenu } from "@/components/settings-menu";
import { Stepper } from "@/components/stepper";
import { StepPrompt } from "@/components/step-prompt";
import { StepTargeting } from "@/components/step-targeting";
import type {
  ClarificationAnswer,
  TargetingResult,
} from "@/lib/campaign-data";

function mergeClarificationAnswers(
  previous: ClarificationAnswer[],
  next: ClarificationAnswer[],
): ClarificationAnswer[] {
  const merged = new Map<string, ClarificationAnswer>();
  for (const answer of [...previous, ...next]) {
    merged.set(answer.slot?.trim() || `issue:${answer.issueId}`, answer);
  }
  return [...merged.values()];
}

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [targeting, setTargeting] = useState<TargetingResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [targetingError, setTargetingError] = useState<string | null>(null);
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    ClarificationAnswer[]
  >([]);

  const updatePrompt = (value: string) => {
    setPrompt(value);
    setTargetingError(null);
    setTargeting(null);
    setClarificationAnswers([]);
  };

  const runTargeting = async (
    newAnswers: ClarificationAnswer[] = [],
    overridePrompt?: string,
  ) => {
    const trimmedPrompt = (overridePrompt ?? prompt).trim();
    if (!trimmedPrompt) return;

    const isFollowUp = newAnswers.length > 0;
    if (isFollowUp ? isClarifying : isExtracting) return;

    const answers = isFollowUp
      ? mergeClarificationAnswers(clarificationAnswers, newAnswers)
      : [];
    isFollowUp ? setIsClarifying(true) : setIsExtracting(true);
    setTargetingError(null);

    try {
      const response = await fetch("/api/targeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          clarificationAnswers: answers,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data && typeof data.error === "string"
            ? data.error
            : "타겟 추출에 실패했습니다.",
        );
      }
      setTargeting(data as TargetingResult);
      setClarificationAnswers(answers);
      setStep(1);
    } catch (error) {
      setTargetingError(
        error instanceof Error ? error.message : "타겟 추출에 실패했습니다.",
      );
    } finally {
      isFollowUp ? setIsClarifying(false) : setIsExtracting(false);
    }
  };

  const pickAlternative = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed === prompt.trim()) return;
    updatePrompt(trimmed);
    return runTargeting([], trimmed);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <div className="flex items-center justify-end gap-2">
        <a href="/reference-data-guide.html" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <FileText className="h-4 w-4" aria-hidden /> 참조문서 설명
        </a>
        <a href="/db-swap-report.html" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <Database className="h-4 w-4" aria-hidden /> DB 전환 가이드
        </a>
        <SettingsMenu />
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-foreground">캠페인 타겟팅 시스템</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          자연어 조건을 검증 가능한 타겟 SQL과 오디언스 결과로 변환합니다.
        </p>
      </header>

      <Stepper current={step} />
      {step === 0 && (
        <StepPrompt
          prompt={prompt}
          setPrompt={updatePrompt}
          onExtract={() => runTargeting()}
          isExtracting={isExtracting}
          error={targetingError}
        />
      )}
      {step === 1 && targeting && (
        <StepTargeting
          result={targeting}
          prompt={prompt}
          onBack={() => setStep(0)}
          onClarify={runTargeting}
          onPickAlternative={pickAlternative}
          isClarifying={isClarifying || isExtracting}
          clarificationAnswers={clarificationAnswers}
        />
      )}
    </main>
  );
}
