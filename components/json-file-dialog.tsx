"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

import { ReferenceContentBody } from "@/components/json-content";

/**
 * 선언 파일 하나를 팝업으로 열어 읽는다.
 *
 * **무엇을 여는가.** 참조 API 의 `profile` 범주 — 지금 배포가 **실제로 읽는** 선언이다. 같은
 * 이름의 파일이 은퇴한 CRMDW 위치에도 있어서, 이름으로만 고르면 배포가 읽지도 않는 사본을
 * "채워야 할 자리" 라며 띄우게 된다. 어느 파일인지는 백엔드가 런타임 설정으로 정하고, 화면은
 * 그 답이 돌려준 `relative_path` 를 그대로 보여 준다.
 *
 * 읽기 전용이다. 편집 엔드포인트는 없다.
 */

type ReferencePayload = {
  name: string;
  relative_path: string;
  format: string;
  size: number;
  description: string;
  content: string;
};

function isPayload(value: unknown): value is ReferencePayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === "string" &&
    typeof row.relative_path === "string" &&
    typeof row.format === "string" &&
    typeof row.content === "string"
  );
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function JsonFileDialog({
  name,
  onClose,
}: {
  /** 열 파일 이름. `null` 이면 팝업을 그리지 않는다. */
  name: string | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<ReferencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!name) return;
    // 팝업을 닫으면 원래 누른 자리로 초점이 돌아가야 키보드로 계속 읽을 수 있다.
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      try {
        restoreFocusRef.current?.focus({ preventScroll: true });
      } catch {
        // 그 요소가 사라졌으면 초점 복원은 포기한다 — 읽기에는 영향이 없다.
      }
    };
  }, [name]);

  useEffect(() => {
    if (!name) {
      setPayload(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPayload(null);
    fetch(`/api/reference/profile/${encodeURIComponent(name)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const detail =
            data && typeof data.detail === "string" ? data.detail : "";
          throw new Error(
            detail === "reference_file_not_found"
              ? "이 배포에서 그 파일을 찾지 못했습니다."
              : detail || "파일을 불러오지 못했습니다.",
          );
        }
        if (!isPayload(data)) {
          throw new Error("파일 응답 형식을 확인하지 못했습니다.");
        }
        setPayload(data);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "파일을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [name, onClose]);

  if (!name) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name} 내용`}
        className="flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-mono text-sm font-semibold text-foreground">
              {name}
            </h2>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {payload
                ? `${payload.relative_path} · ${formatSize(payload.size)}`
                : "이 배포가 읽는 선언"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
            닫기
          </button>
        </div>

        {payload?.description && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {payload.description}
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            불러오는 중…
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {payload && (
          <ReferenceContentBody
            format={payload.format}
            content={payload.content}
            maxHeightClass="max-h-[60vh]"
          />
        )}
      </div>
    </div>
  );
}
