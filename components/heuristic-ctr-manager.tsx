"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  HEURISTIC_CTR_POLICY_NAME,
  MATCHER_FIELDS,
  PROBABILITY_FIELDS,
  SCORE_ADJUSTMENT_FIELDS,
  type HeuristicCtrContent,
  type MatcherKey,
  type ProbabilityFieldKey,
  type ScoreAdjustmentKey,
  buildDefaultHeuristicContent,
  findUnknownAdjustmentKeys,
  normalizeHeuristicContent,
  validateHeuristicContent,
} from "@/lib/heuristic-ctr-catalog";

type ToastState = { type: "success" | "error"; message: string };

type Tab = "form" | "json";

const POLICY_PATH = `/api/policies/${encodeURIComponent(
  HEURISTIC_CTR_POLICY_NAME,
)}`;

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function formatDateTime(value: string | null) {
  if (!value) {
    return "–";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : JSON.stringify(item),
        )
        .join(", ");
    }
  }
  return "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function HeuristicCtrManager() {
  const [content, setContent] = useState<HeuristicCtrContent>(
    buildDefaultHeuristicContent,
  );
  const [description, setDescription] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("form");
  const [jsonText, setJsonText] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const applyLoaded = useCallback(
    (raw: unknown, meta: { description?: unknown; updated_at?: unknown }) => {
      const normalized = normalizeHeuristicContent(raw);
      setContent(normalized);
      setDescription(
        typeof meta.description === "string" ? meta.description : "",
      );
      setUpdatedAt(
        typeof meta.updated_at === "string" ? meta.updated_at : null,
      );
      setJsonText(JSON.stringify(normalized, null, 2));
      setJsonError(null);
    },
    [],
  );

  const loadPolicy = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const response = await fetch(POLICY_PATH, { cache: "no-store" });
      if (response.status === 404) {
        // 신규 모드: 코드 기본값으로 프리필.
        setExists(false);
        applyLoaded(null, {});
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractDetail(data) || "정책을 불러오지 못했습니다.");
      }
      setExists(true);
      applyLoaded(data?.content, {
        description: data?.description,
        updated_at: data?.updated_at,
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "정책을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyLoaded]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const warnings = useMemo(
    () => validateHeuristicContent(content),
    [content],
  );
  const unknownAdjustmentKeys = useMemo(
    () => findUnknownAdjustmentKeys(content.score_adjustments),
    [content.score_adjustments],
  );

  const updateProbability = (key: ProbabilityFieldKey, value: number) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const updateAdjustment = (key: ScoreAdjustmentKey, value: number) => {
    setContent((prev) => ({
      ...prev,
      score_adjustments: { ...prev.score_adjustments, [key]: value },
    }));
  };

  const updateMatcher = (key: MatcherKey, values: string[]) => {
    setContent((prev) => ({
      ...prev,
      matchers: { ...prev.matchers, [key]: values },
    }));
  };

  // 폼 → JSON 직렬화 시, 스키마 키의 숫자 타입을 보정한 완전한 객체를 만든다.
  const buildContentForSave = ():
    | { ok: true; content: HeuristicCtrContent }
    | { ok: false; error: string } => {
    if (activeTab === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        return { ok: false, error: "JSON 문법 오류가 있습니다." };
      }
      if (!isPlainObject(parsed)) {
        return { ok: false, error: "content는 JSON 객체({ ... })여야 합니다." };
      }
      // raw JSON은 사용자가 자유 편집하므로 그대로 저장하되, 타입 형태만 확인.
      return { ok: true, content: parsed as unknown as HeuristicCtrContent };
    }
    return { ok: true, content };
  };

  const switchTab = (next: Tab) => {
    if (next === activeTab) {
      return;
    }
    if (next === "json") {
      setJsonText(JSON.stringify(content, null, 2));
      setJsonError(null);
      setActiveTab("json");
      return;
    }
    // json → form: 파싱해서 폼 상태로 정규화.
    try {
      const parsed = JSON.parse(jsonText);
      if (!isPlainObject(parsed)) {
        setJsonError("JSON 최상위는 객체({ ... })여야 합니다.");
        return;
      }
      setContent(normalizeHeuristicContent(parsed));
      setJsonError(null);
      setActiveTab("form");
    } catch {
      setJsonError("JSON 문법 오류가 있어 폼으로 전환할 수 없습니다.");
    }
  };

  const persist = async (payload: HeuristicCtrContent) => {
    const response = await fetch(POLICY_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: payload,
        description: description.trim() ? description.trim() : null,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractDetail(data) || "저장에 실패했습니다.");
    }
    return data?.policy as
      | { updated_at?: string; description?: string | null }
      | undefined;
  };

  const busy = isSaving || isApplying || isDeleting;

  const handleSave = async (applyAfter: boolean) => {
    if (busy) {
      return;
    }
    const built = buildContentForSave();
    if (!built.ok) {
      setActionError(built.error);
      return;
    }
    setActionError(null);
    if (applyAfter) {
      setIsApplying(true);
    } else {
      setIsSaving(true);
    }
    try {
      const saved = await persist(built.content);
      setExists(true);
      if (saved?.updated_at) {
        setUpdatedAt(saved.updated_at);
      }

      if (applyAfter) {
        const reloadResponse = await fetch("/api/policies/reload", {
          method: "POST",
        });
        if (!reloadResponse.ok) {
          setHasUnappliedChanges(true);
          showToast({
            type: "error",
            message:
              "적용에 실패했습니다. 저장 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.",
          });
          return;
        }
        setHasUnappliedChanges(false);
        showToast({
          type: "success",
          message: "저장하고 적용했습니다. 다음 스코어링부터 반영됩니다.",
        });
      } else {
        setHasUnappliedChanges(true);
        showToast({ type: "success", message: "저장했습니다. (DB 기록 완료)" });
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "저장에 실패했습니다.",
      );
    } finally {
      setIsSaving(false);
      setIsApplying(false);
    }
  };

  const handleReload = async () => {
    if (busy) {
      return;
    }
    setIsApplying(true);
    setActionError(null);
    try {
      const response = await fetch("/api/policies/reload", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractDetail(data) || "적용에 실패했습니다.");
      }
      setHasUnappliedChanges(false);
      showToast({
        type: "success",
        message: "변경사항을 적용했습니다. 다음 스코어링부터 반영됩니다.",
      });
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "적용에 실패했습니다. 저장 내용은 유지됩니다.",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (busy) {
      return;
    }
    setIsDeleting(true);
    setActionError(null);
    try {
      const response = await fetch(POLICY_PATH, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok && response.status !== 404) {
        throw new Error(extractDetail(data) || "삭제에 실패했습니다.");
      }
      setHasUnappliedChanges(true);
      showToast({
        type: "success",
        message: "삭제했습니다. 서비스는 파일/코드 기본값으로 동작합니다.",
      });
      await loadPolicy();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "삭제에 실패했습니다.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const resetToDefault = () => {
    const defaults = buildDefaultHeuristicContent();
    setContent(defaults);
    setJsonText(JSON.stringify(defaults, null, 2));
    setJsonError(null);
    setActionError(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg bg-muted/60"
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        <span>{loadError}</span>
        <Button variant="outline" size="sm" onClick={loadPolicy}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HowItWorks />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!exists && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              신규 (기본값 프리필)
            </Badge>
          )}
          {hasUnappliedChanges && (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              적용되지 않은 변경사항
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            disabled={busy}
            title="폼 값을 코드 기본값으로 되돌립니다(저장 전까지 DB 미반영)."
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            기본값
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={busy}
            title="저장한 정책을 실행 중인 서버에 즉시 반영합니다."
          >
            {isApplying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            변경사항 적용
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={busy}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            저장
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleSave(true)}
            disabled={busy}
            title="저장 후 실행 중인 서버에 즉시 반영합니다."
          >
            {isApplying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            저장 후 적용
          </Button>
          {exists && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              )}
              삭제
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">설명</label>
        <input
          className={inputClass}
          placeholder="휴리스틱 CTR 룰 (선택)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          수정 시각: {formatDateTime(updatedAt)}
          {updatedAt ? " (KST)" : ""}
        </p>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => switchTab("form")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "form"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            폼
          </button>
          <button
            type="button"
            onClick={() => switchTab("json")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "json"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      {warnings.length > 0 && activeTab === "form" && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
          <span className="flex items-center gap-1 font-medium text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            검증 경고 (저장은 가능 · 백엔드가 최종 클램핑)
          </span>
          <ul className="ml-4 list-disc space-y-0.5">
            {warnings.map((warning, index) => (
              <li key={`${warning.field}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "form" ? (
        <div className="flex flex-col gap-4">
          <Section title="확률 파라미터">
            <div className="grid gap-4 sm:grid-cols-2">
              {PROBABILITY_FIELDS.map((field) => (
                <NumberRow
                  key={field.key}
                  label={field.label}
                  description={field.description}
                  value={content[field.key]}
                  min={0}
                  max={1}
                  onChange={(value) => updateProbability(field.key, value)}
                />
              ))}
            </div>
          </Section>

          <Section
            title="점수 조정 (score_adjustments)"
            hint="조건 충족 시 확률 가감치(절대 확률, 음수 허용)."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {SCORE_ADJUSTMENT_FIELDS.map((field) => (
                <NumberRow
                  key={field.key}
                  label={field.label}
                  description={field.description}
                  value={content.score_adjustments[field.key] ?? field.default}
                  signed
                  onChange={(value) => updateAdjustment(field.key, value)}
                />
              ))}
            </div>
            {unknownAdjustmentKeys.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-xs text-amber-600">
                <span className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  스코어러가 무시하는 키
                </span>
                <span className="text-muted-foreground">
                  아래 키는 8개 고정 집합에 없어 스코어링에 반영되지 않습니다.
                  JSON 탭에서 확인/삭제하세요.
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {unknownAdjustmentKeys.map((key) => (
                    <code
                      key={key}
                      className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700"
                    >
                      {key}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="매처 (matchers)"
            hint="조건 판정에 쓰이는 키워드/집합."
          >
            <div className="flex flex-col gap-4">
              {MATCHER_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {field.label}
                  </label>
                  <TagsControl
                    values={content.matchers[field.key] ?? []}
                    onChange={(values) => updateMatcher(field.key, values)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {field.description}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            content (JSON) <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              setJsonError(null);
            }}
            placeholder='{ "base_probability": 0.025 }'
            className="min-h-[420px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          {jsonError ? (
            <span className="text-xs text-destructive">{jsonError}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              최상위는 JSON 객체(&#123; ... &#125;)여야 합니다. 저장은 전체 객체
              단위를 권장합니다.
            </span>
          )}
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ${
            toast.type === "success"
              ? "bg-card text-foreground ring-foreground/10"
              : "bg-destructive/10 text-destructive ring-destructive/20"
          }`}
          role="status"
        >
          {toast.type === "success" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="휴리스틱 CTR 룰 삭제"
          message="삭제해도 서비스는 파일(docs/policies/heuristic-ctr-rules.json) 또는 코드 기본값으로 계속 동작합니다. 삭제할까요?"
          confirmLabel="삭제"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    "`기준 확률`에서 시작",
    "`점수 조정`의 각 조건이 충족되면 가감치를 더함(음수면 감점)",
    "user·variant 조합으로 결정되는 안정적 노이즈(노이즈 최대 이하)를 더함",
    "최종값을 `최소 확률` ~ `최대 확률`로 클램핑",
  ];
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium text-foreground">
        스코어러는 변형별 예측 CTR을 이렇게 계산합니다
      </p>
      <ol className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        여기서 바꾸는 값이 어떤 유저에게 어떤 변형이 우선 노출되는지에 직접
        영향을 줍니다.
      </p>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

type NumberRowProps = {
  label: string;
  description: string;
  value: number;
  min?: number;
  max?: number;
  signed?: boolean;
  onChange: (value: number) => void;
};

function NumberRow({
  label,
  description,
  value,
  min,
  max,
  signed,
  onChange,
}: NumberRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="number"
        className={inputClass}
        value={value}
        min={min}
        max={max}
        step={0.001}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "" || raw === "-") {
            onChange(0);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
      <span className="text-xs text-muted-foreground">
        {description}
        {signed ? " (음수 허용)" : ""}
      </span>
    </div>
  );
}

function TagsControl({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const next = draft.trim();
    if (!next || values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
          >
            <code>{tag}</code>
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== tag))}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`${tag} 제거`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground">
            비어 있으면 이 조건은 트리거되지 않습니다.
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          className={`${inputClass} font-mono`}
          value={draft}
          placeholder="키워드 입력 후 추가"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          추가
        </Button>
      </div>
    </div>
  );
}

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-5 shadow-xl ring-1 ring-foreground/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
