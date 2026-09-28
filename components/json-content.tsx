"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { JsonTree, computeJsonSearch } from "@/components/json-tree";
import { SqlHighlight } from "@/components/sql-highlight";

/**
 * 참조 파일 본문 렌더 — 참조 파일 화면과 세팅 화면의 팝업이 **같은 이것**을 쓴다.
 *
 * 두 벌로 적으면 한쪽만 고쳐졌을 때 같은 파일이 화면마다 다르게 보인다. 원래 이 함수는
 * `reference-viewer.tsx` 안에 있었고, 팝업이 생기면서 여기로 옮겼다.
 */

/** 이 파일과 참조 화면이 함께 쓰는 입력칸 스타일. 정의는 한 곳에 둔다. */
export const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * JSON 은 접이식 트리(기본, 키·값 검색·하이라이트)와 원본 텍스트를 토글할 수 있게 하고,
 * SQL 은 구문 강조, 그 외 포맷은 단순 monospace 로 보여준다. JSON 파싱 실패 시 원본 폴백.
 */
export function ReferenceContentBody({
  format,
  content,
  maxHeightClass = "max-h-[70vh]",
}: {
  format: string;
  content: string;
  /** 팝업처럼 높이가 제한된 자리에서 바꿔 끼운다. */
  maxHeightClass?: string;
}) {
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
    <pre
      className={`${maxHeightClass} overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground`}
    >
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
        <div
          className={`${maxHeightClass} overflow-auto rounded-lg border border-border bg-card p-4`}
        >
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
