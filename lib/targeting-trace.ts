import type {
  TargetingTrace,
  TargetingTraceFailureDiagnosis,
  TargetingTraceHit,
  TargetingTracePathNode,
  TargetingTraceStep,
} from "@/lib/campaign-data";

/**
 * Python /target-sql/trace 응답을 화면에서 쓰기 좋은 형태로 정규화한다.
 *
 * 주 경로는 최상위 `stages` 배열(step 1~10)을 그대로 해석한다.
 * `stages` 가 없는 다른 버전 응답을 대비해, 여러 키 후보를 깊이 탐색하는
 * 폴백 복원 경로도 함께 둔다. 아무 것도 복원하지 못하면 raw 를 담아
 * 화면이 원본 JSON을 그대로 보여줄 수 있게 한다.
 */

type Rec = Record<string, unknown>;

function asRecord(value: unknown): Rec | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

export function parsePythonResponse(rawText: string): unknown {
  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

function getString(record: Rec | null, keys: string[]): string {
  if (!record) {
    return "";
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function getNumber(record: Rec | null, keys: string[]): number | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }
  return null;
}

function getArray(record: Rec | null, keys: string[]): unknown[] {
  if (!record) {
    return [];
  }
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return [];
}

function getBool(record: Rec | null, keys: string[]): boolean | null {
  if (!record) {
    return null;
  }
  const truthy = [
    "true",
    "✓",
    "ok",
    "pass",
    "passed",
    "valid",
    "success",
    "yes",
    "y",
  ];
  const falsy = ["false", "✗", "x", "fail", "failed", "invalid", "no", "n"];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (truthy.includes(lowered)) return true;
      if (falsy.includes(lowered)) return false;
    }
  }
  return null;
}

function toStringList(list: unknown[]): string[] {
  return list
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}

/** api_response 가 문자열(JSON)일 수도, 객체일 수도 있어 양쪽을 흡수한다. */
function getApiResponse(data: unknown): Rec | null {
  const record = asRecord(data);
  if (!record) {
    return null;
  }
  const apiResponse = record.api_response;
  if (typeof apiResponse === "string") {
    return asRecord(parsePythonResponse(apiResponse));
  }
  return asRecord(apiResponse) ?? record;
}

/** 어느 깊이에 있든 keys 중 하나와 일치하는 첫 값을 BFS로 찾는다. */
function deepFindValue(data: unknown, keys: string[], maxDepth = 6): unknown {
  const lowered = keys.map((key) => key.toLowerCase());
  const queue: { value: unknown; depth: number }[] = [
    { value: data, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    const { value, depth } = current;

    const record = asRecord(value);
    if (record) {
      for (const [key, nested] of Object.entries(record)) {
        if (lowered.includes(key.toLowerCase())) {
          return nested;
        }
      }
      if (depth < maxDepth) {
        for (const nested of Object.values(record)) {
          queue.push({ value: nested, depth: depth + 1 });
        }
      }
      continue;
    }

    if (Array.isArray(value) && depth < maxDepth) {
      for (const nested of value) {
        queue.push({ value: nested, depth: depth + 1 });
      }
    }
  }

  return undefined;
}

function deepFindRecord(data: unknown, keys: string[]): Rec | null {
  return asRecord(deepFindValue(data, keys));
}

function deepFindArray(data: unknown, keys: string[]): unknown[] {
  const value = deepFindValue(data, keys);
  return Array.isArray(value) ? value : [];
}

function summarizeObject(record: Rec, prefix: string): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        parts.push(`${key}: [${value.join(", ")}]`);
      }
    } else if (
      value !== null &&
      value !== undefined &&
      typeof value !== "object"
    ) {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.length > 0 ? `${prefix}: { ${parts.join(", ")} }` : "";
}

function clampNote(text: string, max = 140): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function toSearchHit(entry: unknown): TargetingTraceHit | null {
  const record = asRecord(entry);
  if (!record) {
    return typeof entry === "string" && entry.trim()
      ? { label: entry.trim() }
      : null;
  }
  const label = getString(record, ["title", "id", "name", "label", "key"]);
  if (!label) {
    return null;
  }
  const score = getNumber(record, ["score", "similarity", "relevance", "bm25"]);
  const meta = getString(record, ["type"]);
  const snippet = getString(record, ["snippet", "text", "summary"]);
  return {
    label,
    ...(score !== null ? { score } : {}),
    ...(meta ? { meta } : {}),
    ...(snippet ? { note: clampNote(snippet) } : {}),
  };
}

/** reached_via 문자열("seed=..., distance=N")들에서 최소 홉 수를 뽑는다. path 가 없을 때의 폴백. */
function distanceFromReachedVia(reachedVia: string[]): number | null {
  let min: number | null = null;
  for (const reason of reachedVia) {
    const match = reason.match(/distance\s*=\s*(\d+)/i);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && (min === null || value < min)) {
        min = value;
      }
    }
  }
  return min;
}

/** context_nodes[].path (출발점→목표 경로)를 화면용 노드 배열로 정규화한다. */
function toPathNodes(entry: Rec): TargetingTracePathNode[] {
  return getArray(entry, ["path"]).flatMap((node) => {
    const record = asRecord(node);
    const label = getString(record, ["title", "label", "id"]);
    if (!label) {
      return [];
    }
    const type = getString(record, ["type"]);
    const relation = getString(record, ["relation"]);
    return [
      {
        label,
        ...(type ? { type } : {}),
        ...(relation ? { relation } : {}),
      },
    ];
  });
}

function toContextNode(entry: unknown): TargetingTraceHit | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }
  const label = getString(record, ["title", "id", "name", "label"]);
  if (!label) {
    return null;
  }
  const score = getNumber(record, ["score", "seed_score"]);
  const isSeed = getBool(record, ["is_seed"]);
  const type = getString(record, ["type"]);
  const meta = isSeed ? "seed" : type || undefined;
  const reachedVia = toStringList(getArray(record, ["reached_via"]));
  const path = toPathNodes(record);
  // distance: 경로 길이(-1) 우선, 없으면 reached_via 파싱, 그래도 없고 seed 면 0.
  const distance =
    path.length > 0
      ? path.length - 1
      : (distanceFromReachedVia(reachedVia) ?? (isSeed ? 0 : null));
  return {
    label,
    ...(score !== null ? { score } : {}),
    ...(meta ? { meta } : {}),
    ...(type ? { nodeType: type } : {}),
    ...(distance !== null ? { distance } : {}),
    ...(path.length > 0 ? { path } : {}),
    ...(reachedVia.length > 0
      ? { note: clampNote(reachedVia.join(" · ")) }
      : {}),
  };
}

/** 백엔드 status(ok/info/fail/skipped) → 화면 status. ok 는 성공(success)으로 본다. */
function normalizeStatus(raw: string): TargetingTraceStep["status"] {
  const lowered = raw.toLowerCase();
  if (lowered === "ok" || lowered === "success") return "success";
  if (lowered === "fail" || lowered === "error") return "fail";
  if (lowered === "skipped") return "skipped";
  return "info";
}

/**
 * 백엔드 10단계 트레이스(step·name·method·status·plain·details·hits)를 화면 단계로 정규화한다.
 * 백엔드가 이미 단계별 사람 말/기술 라인을 만들어 주므로 여기선 얇게 통과시키고, hits 만 노드로 변환한다.
 * (step 7 hits 는 그래프 노드라 path/reached_via 를 가진 context 노드로, 그 외는 일반 검색 히트로 해석.)
 */
function buildStepFromStage(stage: Rec): TargetingTraceStep | null {
  const step = getNumber(stage, ["step"]);
  const title =
    getString(stage, ["name", "title"]) || (step ? `STEP ${step}` : "단계");
  const method = getString(stage, ["method"]);
  const techName = getString(stage, ["tech_name", "techName"]);
  const status = normalizeStatus(getString(stage, ["status"]));
  const summary = getString(stage, ["summary"]);
  const plain = toStringList(getArray(stage, ["plain"]));
  const details = toStringList(getArray(stage, ["details"]));

  const hits = getArray(stage, ["hits", "context_nodes"])
    .map((entry) => toContextNode(entry) ?? toSearchHit(entry))
    .filter((hit): hit is TargetingTraceHit => hit !== null);
  const count = getNumber(stage, ["count", "hitCount", "context_count"]);

  // 참조 자산(프롬프트/데이터/모델). {kind, name} 형태만 받아들인다.
  const refs = getArray(stage, ["refs"]).flatMap((entry) => {
    const record = asRecord(entry);
    const kind = getString(record, ["kind"]);
    const name = getString(record, ["name"]);
    return kind && name
      ? [{ kind, name, ...(record?.used === true ? { used: true } : {}) }]
      : [];
  });

  return {
    step: step ?? undefined,
    title,
    ...(method ? { method } : {}),
    ...(techName ? { techName } : {}),
    status,
    ...(summary ? { summary } : {}),
    ...(plain.length > 0 ? { plain } : {}),
    ...(details.length > 0 ? { details } : {}),
    ...(hits.length > 0 ? { hits } : {}),
    ...(count !== null ? { hitCount: count } : {}),
    ...(refs.length > 0 ? { refs } : {}),
  };
}

/** stages 가 없는 응답을 위한 방어적 폴백(넓은 키 탐색). */
function buildStepsFromDeepSearch(data: unknown): TargetingTraceStep[] {
  const steps: TargetingTraceStep[] = [];

  const intent = getString(
    deepFindRecord(data, ["query_plan", "queryPlan", "plan"]) ??
      getApiResponse(data),
    ["intent"],
  );
  const targetUser = deepFindRecord(data, ["target_user", "targetUser"]);
  const intentDetails: string[] = [];
  if (targetUser) {
    const summary = summarizeObject(targetUser, "target_user");
    if (summary) intentDetails.push(summary);
  }
  if (intent || intentDetails.length > 0) {
    steps.push({
      title: "의미 추론",
      summary: intent ? `intent=${intent}` : undefined,
      details: intentDetails.length > 0 ? intentDetails : undefined,
      status: "info",
    });
  }

  const buildSearch = (title: string, keys: string[], listKeys: string[]) => {
    const node = deepFindValue(data, keys);
    const list = Array.isArray(node)
      ? node
      : getArray(asRecord(node), listKeys);
    const hits = list
      .map(toSearchHit)
      .filter((hit): hit is TargetingTraceHit => hit !== null);
    const count =
      getNumber(asRecord(node), ["count", "total"]) ??
      (hits.length > 0 ? hits.length : null);
    if (hits.length === 0 && count === null) return;
    steps.push({
      title,
      summary: count !== null ? `${count.toLocaleString()}건` : undefined,
      hits: hits.length > 0 ? hits : undefined,
      hitCount: count,
    });
  };
  buildSearch(
    "벡터검색",
    ["vector", "vector_search", "qdrant", "semantic"],
    ["hits", "results"],
  );
  buildSearch(
    "키워드검색",
    ["keyword", "keyword_search", "bm25", "lexical"],
    ["hits", "results"],
  );

  return steps;
}

function buildTimings(data: unknown): { label: string; ms: number }[] {
  const timings = deepFindRecord(data, ["timings_ms", "timings", "timing_ms"]);
  if (!timings) {
    return [];
  }
  return Object.entries(timings)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([label, value]) => ({ label, ms: value as number }));
}

function getFailureDiagnosis(
  data: unknown,
): TargetingTraceFailureDiagnosis | null {
  const record = deepFindRecord(data, [
    "failure_diagnosis",
    "failureDiagnosis",
  ]);
  if (!record) {
    return null;
  }
  const category = getString(record, ["category"]);
  const label = getString(record, ["label"]);
  const confidence = getString(record, ["confidence"]);
  const summary = getString(record, ["summary"]);
  const evidence = toStringList(getArray(record, ["evidence"]));
  const nextAction = getString(record, ["next_action", "nextAction"]);
  if (!category || !label || !summary || !nextAction) {
    return null;
  }
  return {
    category,
    label,
    confidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : "low",
    summary,
    evidence,
    nextAction,
  };
}

export function normalizeTargetingTrace(data: unknown): TargetingTrace {
  const stages = deepFindArray(data, ["stages"]);
  const steps: TargetingTraceStep[] = [];

  if (stages.length > 0) {
    for (const stage of stages) {
      const record = asRecord(stage);
      if (!record) continue;
      const step = buildStepFromStage(record);
      if (step) steps.push(step);
    }
  }

  if (steps.length === 0) {
    steps.push(...buildStepsFromDeepSearch(data));
  }

  const root = asRecord(data);
  const apiResponse = getApiResponse(data);
  const resultRecord = deepFindRecord(data, ["result"]);
  const executionRecord = deepFindRecord(data, ["execution"]);
  const targetingResult = deepFindRecord(data, [
    "targeting_result",
    "targetingResult",
  ]);

  const execSuccess =
    getBool(executionRecord, ["is_success", "success"]) ??
    getBool(root, ["is_success"]) ??
    getBool(apiResponse, ["is_success"]);

  const status =
    getString(resultRecord, ["status", "final_status", "outcome"]) ||
    getString(root, ["status"]) ||
    (execSuccess === true ? "success" : execSuccess === false ? "fail" : "");
  const message = getString(resultRecord, ["message"]);

  const targetCustomerCount = getNumber(targetingResult, [
    "target_customer_count",
    "targetCustomerCount",
  ]);
  const resultRowCount = getNumber(targetingResult, [
    "result_row_count",
    "resultRowCount",
  ]);
  const targetCampaignCount = getNumber(targetingResult, [
    "target_campaign_count",
    "targetCampaignCount",
  ]);

  const trace: TargetingTrace = { steps };

  const query = getString(root, ["query"]) || getString(apiResponse, ["query"]);
  if (query) {
    trace.query = query;
  }

  const failureDiagnosis = getFailureDiagnosis(data);
  if (failureDiagnosis) {
    trace.failureDiagnosis = failureDiagnosis;
  }

  if (status || message || execSuccess !== null) {
    trace.result = {
      ...(status ? { status } : {}),
      ...(execSuccess !== null ? { success: execSuccess } : {}),
      ...(message ? { message } : {}),
    };
  }

  if (
    execSuccess !== null ||
    targetCustomerCount !== null ||
    resultRowCount !== null ||
    targetCampaignCount !== null
  ) {
    trace.execution = {
      ...(execSuccess !== null ? { success: execSuccess } : {}),
      ...(targetCustomerCount !== null ? { targetCustomerCount } : {}),
      ...(resultRowCount !== null ? { resultRowCount } : {}),
      ...(targetCampaignCount !== null ? { targetCampaignCount } : {}),
    };
  }

  const timings = buildTimings(data);
  if (timings.length > 0) {
    trace.timings = timings;
  }

  if (steps.length === 0) {
    trace.raw = data;
  }

  return trace;
}
