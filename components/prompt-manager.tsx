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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  findUndefinedVariables,
  getCatalogEntry,
} from "@/lib/prompt-catalog";

type Prompt = {
  name: string;
  content: string;
  description: string | null;
  updated_at: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

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

function firstLine(content: string) {
  const line = content.split("\n").find((row) => row.trim().length > 0) ?? "";
  return line.trim();
}

function extractDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    // FastAPI 422 필드 에러 배열
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

export function PromptManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  // 저장했으나 아직 [변경사항 적용]을 누르지 않은 상태
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  // 상세/편집 상태
  const [view, setView] = useState<"list" | "detail">("list");
  const [isNew, setIsNew] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [editingName, setEditingName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
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

  const loadPrompts = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const response = await fetch("/api/prompts", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          extractDetail(data) || "프롬프트 목록을 불러오지 못했습니다.",
        );
      }
      const list = Array.isArray(data?.prompts) ? (data.prompts as Prompt[]) : [];
      setPrompts(list);
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "프롬프트 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const filteredPrompts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return prompts;
    }
    return prompts.filter(
      (prompt) =>
        prompt.name.toLowerCase().includes(keyword) ||
        prompt.content.toLowerCase().includes(keyword) ||
        (prompt.description ?? "").toLowerCase().includes(keyword),
    );
  }, [prompts, search]);

  const openNew = () => {
    setIsNew(true);
    setEditingName("");
    setNameInput("");
    setDescriptionInput("");
    setContentInput("");
    setDetailError(null);
    setView("detail");
  };

  const openDetail = (prompt: Prompt) => {
    setIsNew(false);
    setEditingName(prompt.name);
    setNameInput(prompt.name);
    setDescriptionInput(prompt.description ?? "");
    setContentInput(prompt.content);
    setDetailError(null);
    setView("detail");
  };

  const backToList = () => {
    setView("list");
    setDetailError(null);
  };

  const catalogEntry = useMemo(
    () => getCatalogEntry(isNew ? nameInput.trim() : editingName),
    [isNew, nameInput, editingName],
  );

  const undefinedVariables = useMemo(
    () =>
      findUndefinedVariables(
        isNew ? nameInput.trim() : editingName,
        contentInput,
      ),
    [isNew, nameInput, editingName, contentInput],
  );

  const insertVariable = (variable: string) => {
    const token = `\${${variable}}`;
    const textarea = contentRef.current;
    if (!textarea) {
      setContentInput((prev) => prev + token);
      return;
    }
    const start = textarea.selectionStart ?? contentInput.length;
    const end = textarea.selectionEnd ?? contentInput.length;
    const next =
      contentInput.slice(0, start) + token + contentInput.slice(end);
    setContentInput(next);
    // 삽입 후 커서 위치 복원
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + token.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const targetName = (isNew ? nameInput : editingName).trim();
  const canSave =
    contentInput.trim().length > 0 && targetName.length > 0 && !isSaving && !isApplying;

  // PUT /api/prompts/{name}. 성공 시 갱신된 prompt 반환.
  const persistPrompt = async (): Promise<Prompt> => {
    const response = await fetch(
      `/api/prompts/${encodeURIComponent(targetName)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: contentInput,
          description: descriptionInput.trim() ? descriptionInput.trim() : null,
        }),
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractDetail(data) || "저장에 실패했습니다.");
    }
    return data.prompt as Prompt;
  };

  const handleSave = async (applyAfter: boolean) => {
    if (!canSave) {
      return;
    }
    setDetailError(null);
    if (applyAfter) {
      setIsApplying(true);
    } else {
      setIsSaving(true);
    }

    try {
      await persistPrompt();

      if (applyAfter) {
        const reloadResponse = await fetch("/api/prompts/reload", {
          method: "POST",
        });
        const reloadData = await reloadResponse.json().catch(() => null);
        if (!reloadResponse.ok) {
          // 저장은 끝났고 적용만 실패한 상황
          setHasUnappliedChanges(true);
          await loadPrompts();
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
          message: "저장하고 적용했습니다. 다음 생성 요청부터 반영됩니다.",
        });
      } else {
        setHasUnappliedChanges(true);
        showToast({ type: "success", message: "저장했습니다. (DB 기록 완료)" });
      }

      await loadPrompts();
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
      title: "프롬프트 삭제",
      message:
        "이 프롬프트를 삭제하면 서비스는 파일 또는 코드 기본값을 사용합니다. 삭제할까요?",
      confirmLabel: "삭제",
      onConfirm: async () => {
        setConfirm(null);
        setIsDeleting(true);
        setDetailError(null);
        try {
          const response = await fetch(
            `/api/prompts/${encodeURIComponent(editingName)}`,
            { method: "DELETE" },
          );
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(extractDetail(data) || "삭제에 실패했습니다.");
          }
          setHasUnappliedChanges(true);
          showToast({ type: "success", message: "삭제했습니다." });
          await loadPrompts();
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
      const response = await fetch("/api/prompts/reload", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractDetail(data) || "적용에 실패했습니다.");
      }
      setHasUnappliedChanges(false);
      showToast({
        type: "success",
        message: `프롬프트 ${data?.loaded ?? 0}개를 적용했습니다. 다음 생성 요청부터 반영됩니다.`,
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
        "docs/prompts 파일 내용으로 DB를 덮어씁니다. DB에서 편집한 내용이 있으면 사라집니다. 계속할까요?",
      confirmLabel: "덮어쓰기",
      onConfirm: async () => {
        setConfirm(null);
        setIsSeeding(true);
        try {
          const response = await fetch("/api/prompts/seed", { method: "POST" });
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(extractDetail(data) || "시딩에 실패했습니다.");
          }
          showToast({
            type: "success",
            message: `파일에서 ${data?.count ?? 0}개를 불러왔습니다.`,
          });
          await loadPrompts();
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
          prompts={filteredPrompts}
          totalCount={prompts.length}
          isLoading={isLoadingList}
          error={listError}
          search={search}
          onSearch={setSearch}
          onRetry={loadPrompts}
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
          contentInput={contentInput}
          onContentInput={setContentInput}
          contentRef={contentRef}
          updatedAt={
            prompts.find((prompt) => prompt.name === editingName)?.updated_at ??
            null
          }
          catalogRole={catalogEntry?.role ?? null}
          catalogVariables={catalogEntry?.variables ?? []}
          undefinedVariables={undefinedVariables}
          onInsertVariable={insertVariable}
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
  prompts: Prompt[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  onSearch: (value: string) => void;
  onRetry: () => void;
  onOpen: (prompt: Prompt) => void;
  onNew: () => void;
  onSeed: () => void;
  onReload: () => void;
  isSeeding: boolean;
  isReloading: boolean;
  hasUnappliedChanges: boolean;
};

function ListView({
  prompts,
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
          <h2 className="text-lg font-semibold text-foreground">프롬프트 관리</h2>
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
            title="docs/prompts 파일 내용으로 DB를 초기화합니다."
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
            title="저장한 프롬프트를 실행 중인 서버에 즉시 반영합니다."
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
          placeholder="검색 (name / 내용 / 설명)"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((index) => (
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
      ) : prompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {totalCount === 0
            ? "등록된 프롬프트가 없습니다. [파일에서 시딩] 또는 [+ 새 프롬프트]로 시작하세요."
            : "검색 결과가 없습니다."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {prompts.map((prompt) => (
            <li key={prompt.name}>
              <button
                type="button"
                onClick={() => onOpen(prompt)}
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-muted/40"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium text-foreground">
                      {prompt.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {prompt.description?.trim() ? prompt.description : "–"}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {firstLine(prompt.content) || "(내용 없음)"}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(prompt.updated_at)}
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
          새 프롬프트
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
  contentInput: string;
  onContentInput: (value: string) => void;
  contentRef: React.RefObject<HTMLTextAreaElement | null>;
  updatedAt: string | null;
  catalogRole: string | null;
  catalogVariables: string[];
  undefinedVariables: string[];
  onInsertVariable: (variable: string) => void;
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
  contentInput,
  onContentInput,
  contentRef,
  updatedAt,
  catalogRole,
  catalogVariables,
  undefinedVariables,
  onInsertVariable,
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            목록
          </Button>
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {isNew ? "새 프롬프트" : nameInput}
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
            title="저장한 프롬프트를 실행 중인 서버에 즉시 반영합니다."
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
              placeholder="예: message_generation_user.txt"
              value={nameInput}
              onChange={(event) => onNameInput(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              파일명 규칙: 소문자 + <code>_</code> + <code>.txt</code>
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

        {catalogRole && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">역할:</span>{" "}
            {catalogRole}
          </p>
        )}
        {!isNew && updatedAt && (
          <p className="text-xs text-muted-foreground">
            수정 시각: {formatDateTime(updatedAt)}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            본문 (content) <span className="text-destructive">*</span>
          </label>
          <Textarea
            ref={contentRef}
            value={contentInput}
            onChange={(event) => onContentInput(event.target.value)}
            placeholder="프롬프트 본문을 입력하세요."
            className="min-h-[420px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          {contentInput.trim().length === 0 && (
            <span className="text-xs text-destructive">
              본문은 최소 1자 이상이어야 합니다.
            </span>
          )}
        </div>

        <aside className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <span className="text-sm font-medium text-foreground">
            사용 가능한 변수
          </span>
          {catalogVariables.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {catalogVariables.map((variable) => (
                <li
                  key={variable}
                  className="flex items-center justify-between gap-2"
                >
                  <code className="truncate text-xs text-foreground">
                    {`\${${variable}}`}
                  </code>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onInsertVariable(variable)}
                  >
                    삽입
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {getCatalogEntryHint(isNew, catalogRole)}
            </p>
          )}

          <div className="border-t border-border pt-3">
            {undefinedVariables.length > 0 ? (
              <div className="flex flex-col gap-1 text-xs text-amber-600">
                <span className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  미정의 변수
                </span>
                <span className="text-muted-foreground">
                  카탈로그에 없는 변수입니다. 오타가 아닌지 확인하세요. (저장은
                  가능)
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {undefinedVariables.map((variable) => (
                    <code
                      key={variable}
                      className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700"
                    >
                      {`\${${variable}}`}
                    </code>
                  ))}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                미정의 변수: 없음
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function getCatalogEntryHint(isNew: boolean, catalogRole: string | null) {
  if (isNew) {
    return "카탈로그에 등록된 name을 입력하면 사용 가능한 변수를 안내합니다.";
  }
  if (catalogRole) {
    return "이 프롬프트는 고정 텍스트로, 사용하는 변수가 없습니다.";
  }
  return "이 프롬프트의 변수 정보가 카탈로그에 없습니다.";
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
