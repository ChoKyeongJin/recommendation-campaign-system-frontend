"use client";

import { useEffect, useRef, useState } from "react";
import { Stepper } from "@/components/stepper";
import { StepPrompt } from "@/components/step-prompt";
import { SqlRequestUsage } from "@/components/sql-request-usage";
import {
  chosenStructuringModel,
  DEFAULT_MODEL_OPTION,
  NO_STRUCTURING_MODEL_CHOICES,
  readStructuringModelChoices,
  type StructuringModelChoices,
} from "@/lib/structuring-model";
import { StepTargeting } from "@/components/step-targeting";
import type {
  ClarificationAnswer,
  TargetingResult,
} from "@/lib/campaign-data";
import {
  getTargetingResponseTransport,
  initialTargetingProgressState,
  isTargetingErrorEvent,
  isTargetingResultEvent,
  NdjsonParser,
  reduceTargetingProgress,
  TargetingStreamContract,
  type TargetingProgressState,
} from "@/lib/targeting-progress";

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
  const [quotaRefresh, setQuotaRefresh] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [targeting, setTargeting] = useState<TargetingResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [targetingError, setTargetingError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TargetingProgressState>(
    initialTargetingProgressState,
  );
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    ClarificationAnswer[]
  >([]);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequestRef.current?.abort();
    },
    [],
  );

  const updatePrompt = (value: string) => {
    setPrompt(value);
    setTargetingError(null);
    setTargeting(null);
    setClarificationAnswers([]);
  };

  // 이 배포가 고르게 해 둔 구조화 모델. 목록은 Python 이 소유하므로 화면은 읽기만 한다.
  const [modelChoices, setModelChoices] = useState<StructuringModelChoices>(
    NO_STRUCTURING_MODEL_CHOICES,
  );
  const [structuringModel, setStructuringModel] = useState(DEFAULT_MODEL_OPTION);

  useEffect(() => {
    let cancelled = false;
    // 못 읽어도 화면은 그대로 돈다 — 고르는 칸만 안 뜨고 요청은 배포 기본값으로 나간다.
    fetch("/api/structuring-models", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) setModelChoices(readStructuringModelChoices(payload));
      })
      .catch(() => {
        if (!cancelled) setModelChoices(NO_STRUCTURING_MODEL_CHOICES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runTargeting = async (
    newAnswers: ClarificationAnswer[] = [],
    overridePrompt?: string,
  ) => {
    const trimmedPrompt = (overridePrompt ?? prompt).trim();
    if (!trimmedPrompt) return;

    const isFollowUp = newAnswers.length > 0;
    if (isClarifying || isExtracting) return;

    const answers = isFollowUp
      ? mergeClarificationAnswers(clarificationAnswers, newAnswers)
      : [];
    isFollowUp ? setIsClarifying(true) : setIsExtracting(true);
    setTargetingError(null);
    if (!isFollowUp) setProgress(initialTargetingProgressState);
    activeRequestRef.current?.abort();
    const requestController = new AbortController();
    activeRequestRef.current = requestController;

    try {
      const response = await fetch("/api/targeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          clarificationAnswers: answers,
          // 안 골랐거나 목록 밖이면 `null` 이고, 그때는 칸 자체를 안 싣는다.
          ...(chosenStructuringModel(structuringModel, modelChoices)
            ? {
                structuringModel: chosenStructuringModel(
                  structuringModel,
                  modelChoices,
                ),
              }
            : {}),
        }),
        signal: requestController.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      setQuotaRefresh((value) => value + 1);
      const responseTransport = getTargetingResponseTransport(contentType);
      if (response.ok && responseTransport === "ndjson") {
        if (!response.body) {
          throw new Error("타겟 추출 진행 응답이 비어 있습니다.");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = new NdjsonParser();
        const streamContract = new TargetingStreamContract();
        let result: TargetingResult | null = null;
        let terminalError: string | null = null;
        const consume = (values: unknown[]) => {
          for (const value of values) {
            const event = streamContract.accept(value);
            if (event === null) {
              throw new Error("타겟 추출 진행 응답을 확인하지 못했습니다.");
            }
            setProgress((current) => reduceTargetingProgress(current, event));
            if (isTargetingResultEvent(event)) {
              result = event.data as TargetingResult;
              return true;
            }
            if (isTargetingErrorEvent(event)) {
              terminalError = event.error.message;
              return true;
            }
          }
          return false;
        };
        try {
          let terminalSeen = false;
          while (!terminalSeen) {
            const { done, value } = await reader.read();
            if (done) {
              terminalSeen = consume(parser.push(decoder.decode()));
              if (!terminalSeen) terminalSeen = consume(parser.finish());
              break;
            }
            terminalSeen = consume(
              parser.push(decoder.decode(value, { stream: true })),
            );
          }
          if (terminalSeen) {
            void reader.cancel().catch(() => undefined);
          }
        } catch (error) {
          void reader.cancel().catch(() => undefined);
          throw error;
        }
        if (terminalError) throw new Error(terminalError);
        if (!result) throw new Error("타겟 추출 결과를 받지 못했습니다.");
        setTargeting(result);
        setClarificationAnswers(answers);
        setStep(1);
        return;
      }
      if (response.ok && responseTransport !== "json") {
        throw new Error("타겟 추출 응답 형식을 확인하지 못했습니다.");
      }
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
      if (requestController.signal.aborted) return;
      setTargetingError(
        error instanceof Error ? error.message : "타겟 추출에 실패했습니다.",
      );
    } finally {
      setQuotaRefresh((value) => value + 1);
      if (activeRequestRef.current === requestController) {
        activeRequestRef.current = null;
        if (!requestController.signal.aborted) {
          isFollowUp ? setIsClarifying(false) : setIsExtracting(false);
        }
      }
    }
  };

  const pickAlternative = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed === prompt.trim()) return;
    setStep(0);
    updatePrompt(trimmed);
    return runTargeting([], trimmed);
  };

  return (
    <main className="target-workspace">
      <header className="target-page-header">
        <div>
          <h1>{step === 0 ? "어떤 고객을 찾고 있나요?" : "타겟 결과를 확인해 보세요"}</h1>
          <p>{step === 0
            ? "자연어로 조건을 입력하면 타겟 SQL과 오디언스를 생성합니다."
            : "입력한 조건으로 생성된 SQL과 오디언스를 확인하고 조건을 다듬어 보세요."}</p>
        </div>
        <Stepper current={step} />
      </header>
      <SqlRequestUsage refreshKey={quotaRefresh} />
      {step === 1 && targetingError && <p className="mb-4 text-sm text-destructive" role="alert">{targetingError}</p>}
      {step === 0 && (
        <StepPrompt
          modelChoices={modelChoices}
          structuringModel={structuringModel}
          setStructuringModel={setStructuringModel}
          prompt={prompt}
          setPrompt={updatePrompt}
          onExtract={() => runTargeting()}
          isExtracting={isExtracting}
          progress={progress}
          error={targetingError}
          onRequestSettled={() => setQuotaRefresh((value) => value + 1)}
        />
      )}
      {step === 1 && targeting && (
        <StepTargeting
          accounting={progress.accounting}
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
