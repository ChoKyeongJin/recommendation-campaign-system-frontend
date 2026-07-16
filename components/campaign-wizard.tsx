"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { SettingsMenu } from "@/components/settings-menu";
import { Stepper } from "@/components/stepper";
import { StepPrompt } from "@/components/step-prompt";
import { StepTargeting } from "@/components/step-targeting";
import { StepMessages } from "@/components/step-messages";
import { StepResults } from "@/components/step-results";
import {
  type CampaignMessage,
  type CampaignCtrScore,
  type CampaignExperimentResult,
  type Channel,
  type TargetingResult,
} from "@/lib/campaign-data";

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [channel, setChannel] = useState<Channel>("RCS");
  const [targeting, setTargeting] = useState<TargetingResult | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [targetingError, setTargetingError] = useState<string | null>(null);
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] =
    useState<CampaignExperimentResult | null>(null);
  const [isPredictingClicks, setIsPredictingClicks] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const getVariantCode = (index: number) =>
    String.fromCharCode("A".charCodeAt(0) + index);

  const getCtrScore = async ({
    campaignId,
    experimentResult,
  }: {
    campaignId: string;
    experimentResult: CampaignExperimentResult;
  }) => {
    const response = await fetch("/api/ai/ctr/score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        campaignId,
        experimentId:
          experimentResult.experimentId ??
          experimentResult.experiment?.experiment_id,
        prompt: prompt.trim(),
        channel: channel.toLowerCase(),
        variants: messages.map((message, index) => ({
          code: getVariantCode(index),
          name: message.title || message.tone || `시안 ${message.id}`,
          messageBody: message.body,
          isControl: index === 0,
        })),
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data && typeof data.error === "string"
          ? data.error
          : "클릭률 근거 조회에 실패했습니다.";
      throw new Error(message);
    }

    return data as CampaignCtrScore;
  };

  const updatePrompt = (value: string) => {
    setPrompt(value);
    setTargetingError(null);
    setMessageError(null);
    setMessages([]);
    setExperimentResult(null);
    setPredictionError(null);
  };

  const updateChannel = (value: Channel) => {
    setChannel(value);
    setTargetingError(null);
    setMessageError(null);
    setMessages([]);
    setExperimentResult(null);
    setPredictionError(null);
  };

  const analyzeTargeting = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setTargetingError(null);

    try {
      const response = await fetch("/api/targeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt, channel }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data && typeof data.error === "string"
            ? data.error
            : "타겟팅 분석에 실패했습니다.";
        throw new Error(message);
      }

      setTargeting(data as TargetingResult);
      setMessages([]);
      setMessageError(null);
      setExperimentResult(null);
      setPredictionError(null);
      setStep(1);
    } catch (error) {
      setTargetingError(
        error instanceof Error ? error.message : "타겟팅 분석에 실패했습니다.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const recommendMessages = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isGeneratingMessages) {
      return;
    }

    setIsGeneratingMessages(true);
    setMessageError(null);

    try {
      const response = await fetch("/api/channel-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt, channel }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data && typeof data.error === "string"
            ? data.error
            : "메시지 추천에 실패했습니다.";
        throw new Error(message);
      }

      const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(nextMessages as CampaignMessage[]);
      setExperimentResult(null);
      setPredictionError(null);
      setStep(2);
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : "메시지 추천에 실패했습니다.",
      );
    } finally {
      setIsGeneratingMessages(false);
    }
  };

  const predictClickRates = async () => {
    if (isPredictingClicks) {
      return;
    }

    if (messages.length === 0) {
      setPredictionError("클릭률 예측에 사용할 메시지가 없습니다.");
      return;
    }

    setIsPredictingClicks(true);
    setPredictionError(null);

    const trimmedPrompt = prompt.trim();
    const campaignId = targeting?.campaignId?.trim() || "camp_001";

    try {
      const response = await fetch("/api/campaign-experiments/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          campaignId,
          experimentName: `${trimmedPrompt || "캠페인"} ${channel} 메시지 클릭률 예측`,
          channel: channel.toLowerCase(),
          primaryMetric: "ctr",
          assignmentMethod: "model",
          epsilon: 0.2,
          providerMessageIdPrefix: `web-${channel.toLowerCase()}-campaign`,
          userIds: ["user_001", "user_002"],
          includeAnalysis: true,
          variants: messages.map((message, index) => ({
            code: getVariantCode(index),
            name: message.title || message.tone || `시안 ${message.id}`,
            messageBody: message.body,
            isControl: index === 0,
          })),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data && typeof data.error === "string"
            ? data.error
            : "클릭률 예측에 실패했습니다.";
        throw new Error(message);
      }

      const nextExperimentResult = data as CampaignExperimentResult;
      const ctrScore = await getCtrScore({
        campaignId,
        experimentResult: nextExperimentResult,
      }).catch(() => null);

      setExperimentResult({
        ...nextExperimentResult,
        ...(ctrScore ? { ctrScore } : {}),
      });
      setStep(3);
    } catch (error) {
      setPredictionError(
        error instanceof Error ? error.message : "클릭률 예측에 실패했습니다.",
      );
    } finally {
      setIsPredictingClicks(false);
    }
  };

  const restart = () => {
    setStep(0);
    setPrompt("");
    setChannel("RCS");
    setTargeting(null);
    setMessages([]);
    setExperimentResult(null);
    setTargetingError(null);
    setMessageError(null);
    setPredictionError(null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <div className="flex items-center justify-end gap-2">
        <SettingsMenu />
        <a
          href="/system-report.html"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <FileText className="h-4 w-4" aria-hidden />
          시스템 보고서
        </a>
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-foreground">
            캠페인 자동 생성 시스템
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          목표만 입력하면 타겟팅부터 메시지, 예상 클릭률까지 한 번에 추천해
          드립니다.
        </p>
      </header>

      <Stepper current={step} />

      {step === 0 && (
        <StepPrompt
          prompt={prompt}
          setPrompt={updatePrompt}
          channel={channel}
          setChannel={updateChannel}
          onAnalyze={analyzeTargeting}
          isAnalyzing={isAnalyzing}
          error={targetingError}
        />
      )}
      {step === 1 && targeting && (
        <StepTargeting
          result={targeting}
          onBack={() => setStep(0)}
          onNext={recommendMessages}
          isNextLoading={isGeneratingMessages}
          nextError={messageError}
        />
      )}
      {step === 2 && (
        <StepMessages
          messages={messages}
          channel={channel}
          onBack={() => setStep(1)}
          onNext={predictClickRates}
          isNextLoading={isPredictingClicks}
          nextError={predictionError}
        />
      )}
      {step === 3 && experimentResult && (
        <StepResults
          result={experimentResult}
          channel={channel}
          onBack={() => setStep(2)}
          onRestart={restart}
        />
      )}
    </main>
  );
}
