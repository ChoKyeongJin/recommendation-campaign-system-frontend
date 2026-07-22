"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonTree, computeJsonSearch } from "@/components/json-tree";
import { SqlHighlight } from "@/components/sql-highlight";

// 백엔드 /reference-files 응답 형태.
type ReferenceFile = {
  category: "data" | "prompts";
  name: string;
  size: number;
  format: string;
  description: string;
};

type ReferenceFileDetail = ReferenceFile & { content: string };

const CATEGORY_LABEL: Record<string, string> = {
  data: "데이터 · 사전 (docs/data)",
  prompts: "프롬프트 (docs/prompts)",
};

const CATEGORY_ORDER = ["data", "prompts"] as const;

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function extractDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
  }
  return "";
}

export function ReferenceViewer() {
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<ReferenceFile | null>(null);
  const [detail, setDetail] = useState<ReferenceFileDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const response = await fetch("/api/reference", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractDetail(data) || "파일 목록을 불러오지 못했습니다.");
      }
      const list = Array.isArray(data?.files)
        ? (data.files as ReferenceFile[])
        : [];
      setFiles(list);
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "파일 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const openFile = useCallback(async (file: ReferenceFile) => {
    setSelected(file);
    setDetail(null);
    setDetailError(null);
    setCopied(false);
    setIsLoadingDetail(true);
    try {
      const response = await fetch(
        `/api/reference/${encodeURIComponent(file.category)}/${encodeURIComponent(file.name)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractDetail(data) || "파일을 불러오지 못했습니다.");
      }
      setDetail(data as ReferenceFileDetail);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "파일을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const backToList = () => {
    setSelected(null);
    setDetail(null);
    setDetailError(null);
  };

  const handleCopy = async () => {
    if (!detail) {
      return;
    }
    try {
      await navigator.clipboard.writeText(detail.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없어도 화면 열람에는 영향 없음.
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return files;
    }
    return files.filter(
      (file) =>
        file.name.toLowerCase().includes(keyword) ||
        file.description.toLowerCase().includes(keyword),
    );
  }, [files, search]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, ReferenceFile[]>();
    for (const file of filtered) {
      const bucket = byCategory.get(file.category) ?? [];
      bucket.push(file);
      byCategory.set(file.category, bucket);
    }
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      items: byCategory.get(category) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [filtered]);

  if (selected) {
    return (
      <DetailView
        file={selected}
        detail={detail}
        isLoading={isLoadingDetail}
        error={detailError}
        copied={copied}
        onBack={backToList}
        onCopy={handleCopy}
        onRetry={() => openFile(selected)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">참조 파일</h2>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            읽기 전용
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadFiles}
          disabled={isLoadingList}
        >
          {isLoadingList ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          새로고침
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          className={`${inputClass} pl-9`}
          placeholder="검색 (파일명 / 설명)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoadingList ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg bg-muted/60"
            />
          ))}
        </div>
      ) : listError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{listError}</span>
          <Button variant="outline" size="sm" onClick={loadFiles}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            다시 시도
          </Button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {files.length === 0
            ? "표시할 파일이 없습니다."
            : "검색 결과가 없습니다."}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((group) => (
            <section key={group.category} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {group.label}{" "}
                <span className="font-normal">({group.items.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((file) => (
                  <li key={`${file.category}/${file.name}`}>
                    <button
                      type="button"
                      onClick={() => openFile(file)}
                      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-muted/40"
                    >
                      <FileText
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-sm font-medium text-foreground">
                            {file.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] uppercase text-muted-foreground"
                          >
                            {file.format}
                          </Badge>
                        </div>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {file.description || "(설명 없음)"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatSize(file.size)}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <span className="text-sm text-muted-foreground">총 {files.length}개</span>
    </div>
  );
}

type DetailViewProps = {
  file: ReferenceFile;
  detail: ReferenceFileDetail | null;
  isLoading: boolean;
  error: string | null;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
  onRetry: () => void;
};

function DetailView({
  file,
  detail,
  isLoading,
  error,
  copied,
  onBack,
  onCopy,
  onRetry,
}: DetailViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            목록
          </Button>
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {file.name}
          </span>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            읽기 전용
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCopy}
          disabled={!detail}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copied ? "복사됨" : "본문 복사"}
        </Button>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {CATEGORY_LABEL[file.category] ?? file.category}
          </span>
          <span>·</span>
          <span className="uppercase">{file.format}</span>
          <span>·</span>
          <span>{formatSize(file.size)}</span>
        </div>
        {file.description && (
          <p className="text-sm text-foreground">{file.description}</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            다시 시도
          </Button>
        </div>
      ) : detail ? (
        <ContentBody format={detail.format} content={detail.content} />
      ) : null}
    </div>
  );
}

// 본문 렌더. JSON 은 접이식 트리(기본, 키/값 검색·하이라이트)와 원본 텍스트를 토글할 수 있게
// 하고, SQL 은 구문 강조, 그 외 포맷은 단순 monospace 로 보여준다. JSON 파싱 실패 시 원본 폴백.
function ContentBody({ format, content }: { format: string; content: string }) {
  const [jsonMode, setJsonMode] = useState<"tree" | "raw">("tree");
  const [rawQuery, setRawQuery] = useState("");
  // 큰 트리에서 매 타건마다 순회하지 않도록 입력을 디바운스한다.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 200);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const parsed = useMemo(() => {
    if (format !== "json") {
      return { ok: false as const, value: null };
    }
    try {
      return { ok: true as const, value: JSON.parse(content) };
    } catch {
      return { ok: false as const, value: null };
    }
  }, [format, content]);

  const search = useMemo(
    () =>
      parsed.ok && jsonMode === "tree"
        ? computeJsonSearch(parsed.value, query)
        : null,
    [parsed, jsonMode, query],
  );

  const rawBlock = (
    <pre className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground">
      {content}
    </pre>
  );

  if (format === "sql") {
    return <SqlHighlight content={content} />;
  }

  if (!parsed.ok) {
    return rawBlock;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 self-start rounded-lg border border-border p-0.5 text-xs">
          {(["tree", "raw"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setJsonMode(mode)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                jsonMode === mode
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "tree" ? "트리" : "원본"}
            </button>
          ))}
        </div>
        {jsonMode === "tree" && (
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
            <input
              className={`${inputClass} h-8 w-56 pl-8 text-xs`}
              placeholder="키·값 검색"
              value={rawQuery}
              onChange={(event) => setRawQuery(event.target.value)}
            />
            {query.trim() && search && (
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {search.count}건
              </span>
            )}
          </div>
        )}
      </div>
      {jsonMode === "tree" ? (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card p-4">
          <JsonTree
            value={parsed.value}
            query={query}
            search={search ?? undefined}
          />
        </div>
      ) : (
        rawBlock
      )}
    </div>
  );
}
