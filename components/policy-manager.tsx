"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type PolicyField,
  type PolicySchema,
  findUnknownKeys,
  getPolicySchema,
  summarizeContent,
} from "@/lib/policy-catalog";

type Policy = {
  name: string;
  content: Record<string, unknown>;
  description: string | null;
  updated_at: string;
};

type ToastState = { type: "success" | "error"; message: string };

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

type Tab = "form" | "json";

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function formatDateTime(value: string) {
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
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

export function PolicyManager() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  const [view, setView] = useState<"list" | "detail">("list");
  const [isNew, setIsNew] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [editingName, setEditingName] = useState("");
  const [contentDraft, setContentDraft] = useState<Record<string, unknown>>({});
  const [jsonText, setJsonText] = useState("{}");
  const [activeTab, setActiveTab] = useState<Tab>("json");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  const loadPolicies = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const response = await fetch("/api/policies", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          extractDetail(data) || "정책 목록을 불러오지 못했습니다.",
        );
      }
      const list = Array.isArray(data?.policies)
        ? (data.policies as Policy[])
        : [];
      setPolicies(list);
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "정책 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const filteredPolicies = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return policies;
    }
    return policies.filter(
      (policy) =>
        policy.name.toLowerCase().includes(keyword) ||
        (policy.description ?? "").toLowerCase().includes(keyword),
    );
  }, [policies, search]);

  const schema = useMemo(
    () => getPolicySchema(isNew ? nameInput.trim() : editingName),
    [isNew, nameInput, editingName],
  );

  const openNew = () => {
    setIsNew(true);
    setEditingName("");
    setNameInput("");
    setDescriptionInput("");
    setContentDraft({});
    setJsonText("{}");
    setActiveTab("json");
    setJsonError(null);
    setDetailError(null);
    setView("detail");
  };

  const openDetail = (policy: Policy) => {
    const policySchema = getPolicySchema(policy.name);
    const content = isPlainObject(policy.content) ? policy.content : {};
    setIsNew(false);
    setEditingName(policy.name);
    setNameInput(policy.name);
    setDescriptionInput(policy.description ?? "");
    setContentDraft(content);
    setJsonText(JSON.stringify(content, null, 2));
    setActiveTab(policySchema ? "form" : "json");
    setJsonError(null);
    setDetailError(null);
    setView("detail");
  };

  const backToList = () => {
    setView("list");
    setDetailError(null);
  };

  // 스키마 필드의 현재 값(초안에 없으면 기본값).
  const resolveFieldValue = useCallback(
    (field: PolicyField) =>
      field.key in contentDraft ? contentDraft[field.key] : field.default,
    [contentDraft],
  );

  const updateField = (key: string, value: unknown) => {
    setContentDraft((prev) => ({ ...prev, [key]: value }));
  };

  // 폼 값을 저장용 content 객체로 구체화(스키마 키 + 알 수 없는 키 보존).
  const resolveContentFromForm = useCallback((): Record<string, unknown> => {
    if (!schema) {
      return { ...contentDraft };
    }
    const resolved: Record<string, unknown> = { ...contentDraft };
    for (const field of schema.fields) {
      resolved[field.key] =
        field.key in contentDraft ? contentDraft[field.key] : field.default;
    }
    return resolved;
  }, [schema, contentDraft]);

  const switchTab = (next: Tab) => {
    if (next === activeTab) {
      return;
    }
    if (next === "json") {
      setJsonText(JSON.stringify(resolveContentFromForm(), null, 2));
      setJsonError(null);
      setActiveTab("json");
      return;
    }
    // json → form: 파싱해서 초안에 반영
    try {
      const parsed = JSON.parse(jsonText);
      if (!isPlainObject(parsed)) {
        setJsonError("JSON 최상위는 객체({ ... })여야 합니다.");
        return;
      }
      setContentDraft(parsed);
      setJsonError(null);
      setActiveTab("form");
    } catch {
      setJsonError("JSON 문법 오류가 있어 폼으로 전환할 수 없습니다.");
    }
  };

  const targetName = (isNew ? nameInput : editingName).trim();

  // 저장 대상 content 계산(활성 탭 기준).
  const buildContentForSave = ():
    | { ok: true; content: Record<string, unknown> }
    | { ok: false; error: string } => {
    if (activeTab === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        return { ok: false, error: "JSON 문법 오류가 있습니다." };
      }
      if (!isPlainObject(parsed)) {
        return {
          ok: false,
          error: "content는 JSON 객체({ ... })여야 합니다.",
        };
      }
      return { ok: true, content: parsed };
    }
    return { ok: true, content: resolveContentFromForm() };
  };

  const canSave = targetName.length > 0 && !isSaving && !isApplying;

  const persistPolicy = async (
    content: Record<string, unknown>,
  ): Promise<Policy> => {
    const response = await fetch(
      `/api/policies/${encodeURIComponent(targetName)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          description: descriptionInput.trim() ? descriptionInput.trim() : null,
        }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractDetail(data) || "저장에 실패했습니다.");
    }
    return data.policy as Policy;
  };

  const handleSave = async (applyAfter: boolean) => {
    if (!canSave) {
      return;
    }
    const built = buildContentForSave();
    if (!built.ok) {
      setDetailError(built.error);
      return;
    }

    setDetailError(null);
    if (applyAfter) {
      setIsApplying(true);
    } else {
      setIsSaving(true);
    }

    try {
      await persistPolicy(built.content);

      if (applyAfter) {
        const reloadResponse = await fetch("/api/policies/reload", {
          method: "POST",
        });
        const reloadData = await reloadResponse.json().catch(() => null);
        if (!reloadResponse.ok) {
          setHasUnappliedChanges(true);
          await loadPolicies();
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

      await loadPolicies();
      setView("list");
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "저장에 실패했습니다.",
      );
    } finally {
      setIsSaving(false);
      setIsApplying(false);
    }
  };

  const handleDelete = () => {
    setConfirm({
      title: "정책 삭제",
      message:
        "이 정책을 삭제하면 서비스는 파일 또는 코드 기본값을 사용합니다. 삭제할까요?",
      confirmLabel: "삭제",
      onConfirm: async () => {
        setConfirm(null);
        setIsDeleting(true);
        setDetailError(null);
        try {
          const response = await fetch(
            `/api/policies/${encodeURIComponent(editingName)}`,
            { method: "DELETE" },
          );
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(extractDetail(data) || "삭제에 실패했습니다.");
          }
          setHasUnappliedChanges(true);
          showToast({ type: "success", message: "삭제했습니다." });
          await loadPolicies();
          setView("list");
        } catch (error) {
          setDetailError(
            error instanceof Error ? error.message : "삭제에 실패했습니다.",
          );
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleReload = async () => {
    if (isReloading) {
      return;
    }
    setIsReloading(true);
    try {
      const response = await fetch("/api/policies/reload", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractDetail(data) || "적용에 실패했습니다.");
      }
      setHasUnappliedChanges(false);
      showToast({
        type: "success",
        message: `정책 ${data?.loaded ?? 0}개를 적용했습니다. 다음 스코어링부터 반영됩니다.`,
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
      setIsReloading(false);
    }
  };

  const handleSeed = () => {
    setConfirm({
      title: "파일에서 시딩",
      message:
        "docs/policies 파일 내용으로 DB를 덮어씁니다. DB에서 편집한 내용이 있으면 사라집니다. 계속할까요?",
      confirmLabel: "덮어쓰기",
      onConfirm: async () => {
        setConfirm(null);
        setIsSeeding(true);
        try {
          const response = await fetch("/api/policies/seed", {
            method: "POST",
          });
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(extractDetail(data) || "시딩에 실패했습니다.");
          }
          showToast({
            type: "success",
            message: `파일에서 ${data?.count ?? 0}개를 불러왔습니다.`,
          });
          await loadPolicies();
        } catch (error) {
          showToast({
            type: "error",
            message:
              error instanceof Error ? error.message : "시딩에 실패했습니다.",
          });
        } finally {
          setIsSeeding(false);
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {view === "list" ? (
        <ListView
          policies={filteredPolicies}
          totalCount={policies.length}
          isLoading={isLoadingList}
          error={listError}
          search={search}
          onSearch={setSearch}
          onRetry={loadPolicies}
          onOpen={openDetail}
          onNew={openNew}
          onSeed={handleSeed}
          onReload={handleReload}
          isSeeding={isSeeding}
          isReloading={isReloading}
          hasUnappliedChanges={hasUnappliedChanges}
        />
      ) : (
        <DetailView
          isNew={isNew}
          nameInput={nameInput}
          onNameInput={setNameInput}
          descriptionInput={descriptionInput}
          onDescriptionInput={setDescriptionInput}
          schema={schema}
          resolveFieldValue={resolveFieldValue}
          onUpdateField={updateField}
          contentDraft={contentDraft}
          activeTab={activeTab}
          onSwitchTab={switchTab}
          jsonText={jsonText}
          onJsonText={(value) => {
            setJsonText(value);
            setJsonError(null);
          }}
          jsonError={jsonError}
          updatedAt={
            policies.find((policy) => policy.name === editingName)
              ?.updated_at ?? null
          }
          onBack={backToList}
          onSave={() => handleSave(false)}
          onSaveAndApply={() => handleSave(true)}
          onDelete={handleDelete}
          canSave={canSave}
          isSaving={isSaving}
          isApplying={isApplying}
          isDeleting={isDeleting}
          error={detailError}
        />
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

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

type ListViewProps = {
  policies: Policy[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  onSearch: (value: string) => void;
  onRetry: () => void;
  onOpen: (policy: Policy) => void;
  onNew: () => void;
  onSeed: () => void;
  onReload: () => void;
  isSeeding: boolean;
  isReloading: boolean;
  hasUnappliedChanges: boolean;
};

function ListView({
  policies,
  totalCount,
  isLoading,
  error,
  search,
  onSearch,
  onRetry,
  onOpen,
  onNew,
  onSeed,
  onReload,
  isSeeding,
  isReloading,
  hasUnappliedChanges,
}: ListViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">정책 관리</h2>
          {hasUnappliedChanges && (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              적용되지 않은 변경사항
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSeed}
            disabled={isSeeding}
            title="docs/policies 파일 내용으로 DB를 초기화합니다."
          >
            {isSeeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-3.5 w-3.5" aria-hidden />
            )}
            파일에서 시딩
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onReload}
            disabled={isReloading}
            title="저장한 정책을 실행 중인 서버에 즉시 반영합니다."
          >
            {isReloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {isReloading ? "적용 중…" : "변경사항 적용"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          className={`${inputClass} pl-9`}
          placeholder="검색 (name / 설명)"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg bg-muted/60"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            다시 시도
          </Button>
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {totalCount === 0
            ? "등록된 정책이 없습니다. [파일에서 시딩] 또는 [+ 새 정책]으로 시작하세요."
            : "검색 결과가 없습니다."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {policies.map((policy) => (
            <li key={policy.name}>
              <button
                type="button"
                onClick={() => onOpen(policy)}
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-muted/40"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium text-foreground">
                      {policy.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {policy.description?.trim() ? policy.description : "–"}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {summarizeContent(policy.content) || "(내용 없음)"}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(policy.updated_at)}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">총 {totalCount}개</span>
        <Button variant="outline" size="sm" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          새 정책
        </Button>
      </div>
    </div>
  );
}

type DetailViewProps = {
  isNew: boolean;
  nameInput: string;
  onNameInput: (value: string) => void;
  descriptionInput: string;
  onDescriptionInput: (value: string) => void;
  schema: PolicySchema | null;
  resolveFieldValue: (field: PolicyField) => unknown;
  onUpdateField: (key: string, value: unknown) => void;
  contentDraft: Record<string, unknown>;
  activeTab: Tab;
  onSwitchTab: (tab: Tab) => void;
  jsonText: string;
  onJsonText: (value: string) => void;
  jsonError: string | null;
  updatedAt: string | null;
  onBack: () => void;
  onSave: () => void;
  onSaveAndApply: () => void;
  onDelete: () => void;
  canSave: boolean;
  isSaving: boolean;
  isApplying: boolean;
  isDeleting: boolean;
  error: string | null;
};

function DetailView({
  isNew,
  nameInput,
  onNameInput,
  descriptionInput,
  onDescriptionInput,
  schema,
  resolveFieldValue,
  onUpdateField,
  contentDraft,
  activeTab,
  onSwitchTab,
  jsonText,
  onJsonText,
  jsonError,
  updatedAt,
  onBack,
  onSave,
  onSaveAndApply,
  onDelete,
  canSave,
  isSaving,
  isApplying,
  isDeleting,
  error,
}: DetailViewProps) {
  const busy = isSaving || isApplying || isDeleting;
  const unknownKeys = findUnknownKeys(schema, contentDraft);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            목록
          </Button>
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {isNew ? "새 정책" : nameInput}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!canSave || busy}
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
            onClick={onSaveAndApply}
            disabled={!canSave || busy}
            title="저장한 정책을 실행 중인 서버에 즉시 반영합니다."
          >
            {isApplying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {isApplying ? "적용 중…" : "저장 후 적용"}
          </Button>
          {!isNew && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
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

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {isNew && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              name <span className="text-destructive">*</span>
            </label>
            <input
              className={`${inputClass} font-mono`}
              placeholder="예: ctr-model-policy"
              value={nameInput}
              onChange={(event) => onNameInput(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              파일명 규칙: 소문자 + 하이픈, 확장자 없음
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">설명</label>
          <input
            className={inputClass}
            placeholder="용도 메모 (선택)"
            value={descriptionInput}
            onChange={(event) => onDescriptionInput(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {!isNew && updatedAt ? (
            <p className="text-xs text-muted-foreground">
              수정 시각: {formatDateTime(updatedAt)}
            </p>
          ) : (
            <span />
          )}
          {schema && (
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => onSwitchTab("form")}
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
                onClick={() => onSwitchTab("json")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === "json"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === "form" && schema ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          {schema.fields.map((field) => (
            <PolicyFieldRow
              key={field.key}
              field={field}
              value={resolveFieldValue(field)}
              enabled={
                !field.enabledWhen ||
                Boolean(contentDraft[field.enabledWhen] ??
                  schema.fields.find((f) => f.key === field.enabledWhen)
                    ?.default)
              }
              onChange={(value) => onUpdateField(field.key, value)}
            />
          ))}
          {unknownKeys.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-amber-600">
              <span className="flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                스키마에 없는 키
              </span>
              <span className="text-muted-foreground">
                아래 키는 폼에서 편집할 수 없습니다. JSON 탭에서 확인하세요. (저장은
                가능)
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {unknownKeys.map((key) => (
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
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            content (JSON) <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={jsonText}
            onChange={(event) => onJsonText(event.target.value)}
            placeholder='{ "key": "value" }'
            className="min-h-[360px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          {jsonError ? (
            <span className="text-xs text-destructive">{jsonError}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              최상위는 JSON 객체(&#123; ... &#125;)여야 합니다.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

type PolicyFieldRowProps = {
  field: PolicyField;
  value: unknown;
  enabled: boolean;
  onChange: (value: unknown) => void;
};

function PolicyFieldRow({
  field,
  value,
  enabled,
  onChange,
}: PolicyFieldRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        {!enabled && (
          <span className="text-xs text-muted-foreground">
            (탐험 꺼짐: 비활성)
          </span>
        )}
      </div>

      {field.widget === "text" && (
        <input
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          disabled={!enabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.widget === "toggle" && (
        <ToggleControl
          checked={Boolean(value)}
          disabled={!enabled}
          onChange={onChange}
        />
      )}

      {field.widget === "tags" && (
        <TagsControl
          values={Array.isArray(value) ? (value as string[]) : []}
          disabled={!enabled}
          onChange={onChange}
        />
      )}

      {field.widget === "slider" && (
        <SliderControl
          value={typeof value === "number" ? value : 0}
          min={field.min ?? 0}
          max={field.max ?? 1}
          step={field.step ?? 0.01}
          disabled={!enabled}
          onChange={onChange}
        />
      )}

      <span className="text-xs text-muted-foreground">{field.description}</span>
    </div>
  );
}

function ToggleControl({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
        checked
          ? "border-primary bg-primary"
          : "border-border bg-muted"
      }`}
    >
      <span
        className={`ml-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function TagsControl({
  values,
  disabled,
  onChange,
}: {
  values: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
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
              disabled={disabled}
              onClick={() => onChange(values.filter((item) => item !== tag))}
              className="text-muted-foreground hover:text-destructive disabled:opacity-50"
              aria-label={`${tag} 제거`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-amber-600">
            비어 있으면 모든 모델 버전이 ML 예측 경로로 처리됩니다.
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          className={`${inputClass} font-mono`}
          value={draft}
          disabled={disabled}
          placeholder="접두사 입력 후 추가"
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
          disabled={disabled || !draft.trim()}
          onClick={add}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          추가
        </Button>
      </div>
    </div>
  );
}

function SliderControl({
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        className={`${inputClass} w-24`}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? clamp(parsed) : min);
        }}
      />
      <input
        type="range"
        className="flex-1 accent-primary disabled:opacity-50"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
      />
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
