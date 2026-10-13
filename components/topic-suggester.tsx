"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

import {
  groundingLocation,
  groundingRoleLabel,
  MAX_TOPIC_LENGTH,
  readTopic,
  readTopicSuggestions,
  type TopicSuggestionResult,
} from "@/lib/targeting-suggestion";

const FAILURE = "문장을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * 주제 한 줄로 타겟 조건 문장의 초안을 받아 입력칸에 넣는다.
 *
 * 초안은 실행되지 않는다. `onPick` 은 입력칸을 채우기만 하고, 타겟 추출은 사용자가 문장을
 * 확인한 뒤 직접 누른다. 생성 요청은 호출 한도에서 한 번을 쓰므로, 요청이 끝날 때마다
 * `onSettled` 로 알려 남은 횟수 표시를 다시 읽게 한다.
 */
export function TopicSuggester({
  disabled,
  onPick,
  onSettled,
}: {
  disabled: boolean;
  onPick: (prompt: string) => void;
  onSettled?: () => void;
}) {
  const inputId = useId();
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TopicSuggestionResult | null>(null);
  const [selected, setSelected] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  const sendable = readTopic(topic);
  const blocked = disabled || isLoading;

  const generate = async () => {
    if (!sendable || blocked) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/targeting/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: sendable }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : FAILURE,
        );
      }
      const read = readTopicSuggestions(payload);
      if (!read) throw new Error(FAILURE);
      setResult(read);
      setSelected(0);
      if (read.suggestions.length > 0) onPick(read.suggestions[0].prompt);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setResult(null);
      setError(caught instanceof Error ? caught.message : FAILURE);
    } finally {
      // 실패하거나 취소한 요청도 서버에서는 이미 한 번을 예약했을 수 있다.
      onSettled?.();
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsLoading(false);
      }
    }
  };

  const active = result?.suggestions[selected] ?? null;

  return (
    <section className="topic-suggest" aria-labelledby={`${inputId}-label`}>
      <div className="topic-suggest-heading">
        <label htmlFor={inputId} id={`${inputId}-label`}>
          주제로 문장 만들기
        </label>
        <span>주제에 맞는 타겟 조건 문장을 만들어 드립니다. 생성할 때마다 호출 한도 1회를 씁니다.</span>
      </div>
      <div className="topic-suggest-row">
        <input
          id={inputId}
          type="text"
          className="topic-suggest-input"
          value={topic}
          maxLength={MAX_TOPIC_LENGTH}
          placeholder="예) 첫구매 유도"
          disabled={blocked}
          autoComplete="off"
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={(event) => {
            // 한글 조합 중의 Enter 는 글자를 확정하는 키다 — 그때 보내면 덜 적힌 주제가 나간다.
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void generate();
          }}
        />
        <button
          type="button"
          className="topic-suggest-button"
          onClick={() => void generate()}
          disabled={!sendable || blocked}
        >
          {isLoading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {isLoading ? "생성 중..." : "문장 생성"}
        </button>
      </div>

      {error && (
        <p role="alert" className="topic-suggest-message is-error">
          {error}
        </p>
      )}
      {result && result.suggestions.length === 0 && (
        <p role="status" className="topic-suggest-message">
          {result.message ??
            "이 주제에 맞는 문장을 만들지 못했습니다. 조건을 직접 입력해 주세요."}
        </p>
      )}
      {result && active && (
        <div className="topic-suggest-result">
          <p role="status" className="topic-suggest-message">
            초안을 아래 입력칸에 넣었습니다. 내용을 확인하고 고친 뒤 타겟 추출하기를 눌러 주세요.
          </p>
          {result.analysis && (
            <p className="topic-suggest-note">
              <span>주제 해석</span>
              {result.analysis}
            </p>
          )}
          {result.suggestions.length > 1 && (
            <ul className="topic-suggest-options" aria-label="다른 초안">
              {result.suggestions.map((suggestion, index) => (
                <li key={suggestion.prompt}>
                  <button
                    type="button"
                    className={`topic-suggest-option${index === selected ? " is-active" : ""}`}
                    aria-pressed={index === selected}
                    disabled={disabled}
                    title={suggestion.rationale || undefined}
                    onClick={() => {
                      setSelected(index);
                      onPick(suggestion.prompt);
                    }}
                  >
                    {suggestion.prompt}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {active.rationale && (
            <p className="topic-suggest-note is-rationale">
              <span>이 초안의 근거</span>
              {active.rationale}
            </p>
          )}
          {active.grounding.length > 0 && (
            <ul className="topic-suggest-grounding" aria-label="이 초안이 쓴 데이터 항목">
              {active.grounding.map((item) => {
                const role = groundingRoleLabel(item.role);
                const location = groundingLocation(item);
                return (
                  <li key={`${item.role}:${item.label}:${location ?? ""}`}>
                    {role && <span className="topic-suggest-role">{role}</span>}
                    <span>{item.label}</span>
                    {location && <code>{location}</code>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
