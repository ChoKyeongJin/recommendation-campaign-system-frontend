"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

// 대용량 JSON(수천 노드)에서도 버벅이지 않도록: 깊은 노드는 기본 접힘, 자식은 일정 개수만
// 먼저 렌더하고 나머지는 [더 보기]로 펼친다. 검색 중에는 매칭 경로를 강제로 펼치고 캡을 푼다.
const DEFAULT_OPEN_DEPTH = 1; // 최상위 한 단계만 펼친 채로 시작
const CHILDREN_CHUNK = 100; // 한 번에 렌더하는 자식 수

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// 검색 결과: 매칭된 키/값 경로와, 그 매칭을 드러내기 위해 펼쳐야 할 조상 경로.
export type JsonSearch = {
  keyPaths: Set<string>;
  valuePaths: Set<string>;
  openPaths: Set<string>;
  count: number;
};

const EMPTY_SEARCH: JsonSearch = {
  keyPaths: new Set(),
  valuePaths: new Set(),
  openPaths: new Set(),
  count: 0,
};

function childPathOf(path: string, key: string, isArray: boolean): string {
  return isArray ? `${path}[${key}]` : `${path}.${key}`;
}

/** 트리를 한 번 순회해 검색 매칭 경로 집합을 만든다. 빈 쿼리면 빈 결과. */
export function computeJsonSearch(root: JsonValue, query: string): JsonSearch {
  const trimmed = query.trim();
  if (!trimmed) {
    return EMPTY_SEARCH;
  }
  const q = trimmed.toLowerCase();
  const keyPaths = new Set<string>();
  const valuePaths = new Set<string>();
  const openPaths = new Set<string>();

  function walk(value: JsonValue, path: string, keyLabel: string | null): boolean {
    let matched = false;
    if (keyLabel !== null && keyLabel.toLowerCase().includes(q)) {
      keyPaths.add(path);
      matched = true;
    }
    if (value !== null && typeof value === "object") {
      const isArray = Array.isArray(value);
      const entries: [string, JsonValue][] = isArray
        ? (value as JsonValue[]).map((item, index) => [String(index), item])
        : Object.entries(value as { [key: string]: JsonValue });
      for (const [key, child] of entries) {
        const matchedChild = walk(
          child,
          childPathOf(path, key, isArray),
          isArray ? null : key,
        );
        if (matchedChild) {
          matched = true;
        }
      }
      if (matched) {
        openPaths.add(path);
      }
    } else if (String(value).toLowerCase().includes(q)) {
      valuePaths.add(path);
      matched = true;
    }
    return matched;
  }

  walk(root, "$", null);
  return { keyPaths, valuePaths, openPaths, count: keyPaths.size + valuePaths.size };
}

/** 매칭 부분 문자열을 강조한다. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return <>{text}</>;
  }
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let hit = lower.indexOf(q, start);
  let key = 0;
  while (hit !== -1) {
    if (hit > start) {
      parts.push(text.slice(start, hit));
    }
    parts.push(
      <mark key={key++} className="rounded bg-amber-300/60 text-inherit dark:bg-amber-500/40">
        {text.slice(hit, hit + q.length)}
      </mark>,
    );
    start = hit + q.length;
    hit = lower.indexOf(q, start);
  }
  if (start < text.length) {
    parts.push(text.slice(start));
  }
  return <>{parts}</>;
}

function Primitive({
  value,
  query,
  highlight,
}: {
  value: string | number | boolean | null;
  query: string;
  highlight: boolean;
}) {
  const text = value === null ? "null" : String(value);
  const inner = highlight ? <Highlight text={text} query={query} /> : text;
  if (value === null) {
    return <span className="text-muted-foreground">null</span>;
  }
  if (typeof value === "string") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400">&quot;{inner}&quot;</span>
    );
  }
  if (typeof value === "number") {
    return <span className="text-blue-600 dark:text-blue-400">{inner}</span>;
  }
  return <span className="text-purple-600 dark:text-purple-400">{inner}</span>;
}

function isContainer(value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } {
  return value !== null && typeof value === "object";
}

type NodeProps = {
  keyLabel: string | null; // 객체 키. 배열 항목/루트는 null.
  value: JsonValue;
  depth: number;
  path: string;
  isLast: boolean;
  query: string;
  search: JsonSearch;
};

function Node({ keyLabel, value, depth, path, isLast, query, search }: NodeProps) {
  const [userOpen, setUserOpen] = useState(depth < DEFAULT_OPEN_DEPTH);
  const [shown, setShown] = useState(CHILDREN_CHUNK);
  const comma = isLast ? "" : ",";
  const searching = query.trim().length > 0;
  const forceOpen = searching && search.openPaths.has(path);
  const open = forceOpen || userOpen;

  const keyPrefix =
    keyLabel !== null ? (
      <span className="text-foreground">
        &quot;
        {search.keyPaths.has(path) ? (
          <Highlight text={keyLabel} query={query} />
        ) : (
          keyLabel
        )}
        &quot;
        <span className="text-muted-foreground">: </span>
      </span>
    ) : null;

  if (!isContainer(value)) {
    return (
      <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre-wrap break-words">
        {keyPrefix}
        <Primitive value={value} query={query} highlight={search.valuePaths.has(path)} />
        {comma}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: [string, JsonValue][] = isArray
    ? (value as JsonValue[]).map((item, index) => [String(index), item])
    : Object.entries(value as { [key: string]: JsonValue });
  const openCh = isArray ? "[" : "{";
  const closeCh = isArray ? "]" : "}";
  const count = entries.length;

  if (count === 0) {
    return (
      <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre-wrap break-words">
        {keyPrefix}
        <span className="text-muted-foreground">
          {openCh}
          {closeCh}
        </span>
        {comma}
      </div>
    );
  }

  // 검색으로 강제로 펼친 노드는 캡을 풀어 100번째 이후 매칭도 보이게 한다.
  const effectiveShown = forceOpen ? count : shown;
  const visible = entries.slice(0, effectiveShown);

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 14 }}
        className="flex cursor-pointer items-start rounded hover:bg-muted/40"
        onClick={() => setUserOpen((prev) => !prev)}
      >
        <ChevronRight
          className={`mt-0.5 mr-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="break-words">
          {keyPrefix}
          <span className="text-muted-foreground">{openCh}</span>
          {!open && (
            <span className="text-muted-foreground">
              {" "}
              {isArray ? `${count}개 항목` : `${count}개 필드`} {closeCh}
              {comma}
            </span>
          )}
        </span>
      </div>

      {open && (
        <>
          {visible.map(([childKey, childValue], index) => (
            <Node
              key={childKey}
              keyLabel={isArray ? null : childKey}
              value={childValue}
              depth={depth + 1}
              path={childPathOf(path, childKey, isArray)}
              isLast={index === visible.length - 1 && effectiveShown >= count}
              query={query}
              search={search}
            />
          ))}
          {effectiveShown < count && (
            <div style={{ paddingLeft: (depth + 1) * 14 }} className="py-0.5">
              <button
                type="button"
                onClick={() => setShown((prev) => prev + CHILDREN_CHUNK)}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                … 나머지 {count - effectiveShown}개 더 보기
              </button>
            </div>
          )}
          <div style={{ paddingLeft: depth * 14 }} className="text-muted-foreground">
            {closeCh}
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

/** 파싱된 JSON 값을 접이식 트리로 렌더한다. search 는 computeJsonSearch 결과. */
export function JsonTree({
  value,
  query = "",
  search = EMPTY_SEARCH,
}: {
  value: JsonValue;
  query?: string;
  search?: JsonSearch;
}) {
  return (
    <div className="font-mono text-xs leading-relaxed text-foreground">
      <Node
        keyLabel={null}
        value={value}
        depth={0}
        path="$"
        isLast
        query={query}
        search={search}
      />
    </div>
  );
}
