import type {
  TargetingTrace,
  TargetingTraceHit,
  TargetingTraceStep,
} from "@/lib/campaign-data";

/**
 * Python /target-sql/trace 응답을 화면에서 쓰기 좋은 형태로 정규화한다.
 *
 * 주 경로는 최상위 `stages` 배열(step 1~5)을 그대로 해석한다.
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
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
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
  const truthy = ["true", "✓", "ok", "pass", "passed", "valid", "success", "yes", "y"];
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
  const queue: { value: unknown; depth: number }[] = [{ value: data, depth: 0 }];

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
    } else if (value !== null && value !== undefined && typeof value !== "object") {
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
  return {
    label,
    ...(score !== null ? { score } : {}),
    ...(meta ? { meta } : {}),
    ...(reachedVia.length > 0 ? { note: clampNote(reachedVia.join(" · ")) } : {}),
  };
}

const MARK = (value: boolean | null) => (value === null ? "?" : value ? "✓" : "✗");

/** 최상위 stages 배열(신 버전 응답)을 그대로 해석한다. */
function buildStepFromStage(stage: Rec): TargetingTraceStep | null {
  const step = getNumber(stage, ["step"]);
  const title = getString(stage, ["name", "title"]) || (step ? `STEP ${step}` : "단계");

  // STEP 1 — 의미 추론
  if (step === 1 || /의미|planning|normal/i.test(title)) {
    const intent = getString(stage, ["intent"]);
    const details: string[] = [];

    for (const entry of getArray(stage, ["matched_terms"])) {
      const record = asRecord(entry);
      if (!record) continue;
      const from = getString(record, ["matched_text", "source_term"]);
      const canonical = getString(record, ["canonical", "rule_id"]);
      const matchType = getString(record, ["match_type"]);
      if (from || canonical) {
        const arrow = from && canonical ? `${from} → ${canonical}` : from || canonical;
        details.push(`정규화 매칭: ${arrow}${matchType ? ` (${matchType})` : ""}`);
      }
    }

    const targetUser = asRecord(stage.target_user);
    if (targetUser) {
      const summary = summarizeObject(targetUser, "target_user");
      if (summary) details.push(summary);
    }

    const dimensionFilters = getArray(stage, ["dimension_filters"]);
    if (dimensionFilters.length > 0) {
      const labels = dimensionFilters
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : summarizeObject(asRecord(entry) ?? {}, "").replace(/^: /, ""),
        )
        .filter(Boolean);
      if (labels.length > 0) details.push(`dimension_filters: ${labels.join(", ")}`);
    }

    const retrievalTerms = toStringList(getArray(stage, ["retrieval_terms"]));
    if (retrievalTerms.length > 0) {
      details.push(`retrieval_terms: ${retrievalTerms.join(", ")}`);
    }

    if (!intent && details.length === 0) {
      return null;
    }
    return {
      step: step ?? undefined,
      title,
      summary: intent ? `intent=${intent}` : undefined,
      details: details.length > 0 ? details : undefined,
      status: "info",
    };
  }

  // STEP 2 · 3 — 벡터 / 키워드 검색
  if (step === 2 || step === 3 || /검색|search|vector|keyword|lexical/i.test(title)) {
    const hits = getArray(stage, ["hits"])
      .map(toSearchHit)
      .filter((hit): hit is TargetingTraceHit => hit !== null);
    const count = getNumber(stage, ["count"]) ?? (hits.length > 0 ? hits.length : null);
    if (hits.length === 0 && count === null) {
      return null;
    }
    return {
      step: step ?? undefined,
      title,
      summary: count !== null ? `${count.toLocaleString()}건` : undefined,
      hits: hits.length > 0 ? hits : undefined,
      hitCount: count,
    };
  }

  // STEP 4 — 병합 + Graph 확장
  if (step === 4 || /graph|확장|병합/i.test(title)) {
    const seed = getNumber(stage, ["seed_count", "seed"]);
    const context = getNumber(stage, ["context_count", "context"]);
    const nodes = getArray(stage, ["context_nodes", "nodes"])
      .map(toContextNode)
      .filter((hit): hit is TargetingTraceHit => hit !== null);
    if (seed === null && context === null && nodes.length === 0) {
      return null;
    }
    const summaryParts: string[] = [];
    if (seed !== null) summaryParts.push(`seed=${seed}`);
    if (context !== null) summaryParts.push(`context=${context}`);
    return {
      step: step ?? undefined,
      title,
      summary: summaryParts.length > 0 ? summaryParts.join(" → ") : undefined,
      hits: nodes.length > 0 ? nodes : undefined,
      hitCount: context,
      status: "info",
    };
  }

  // STEP 5 — SQL 생성 / 검증
  if (step === 5 || /sql|생성|검증|guard/i.test(title)) {
    const details: string[] = [];

    const required = toStringList(getArray(stage, ["required_conditions"]));
    if (required.length > 0) {
      details.push(`required_conditions=[${required.join(", ")}]`);
    }

    for (const entry of getArray(stage, ["candidates"])) {
      const record = asRecord(entry);
      if (!record) continue;
      const id = getString(record, ["id", "name", "template"]);
      const flags: string[] = [];
      const guard = getBool(record, ["guard_valid", "guard"]);
      const coverage = getBool(record, ["coverage_ok", "coverage"]);
      const eligible = getBool(record, ["is_eligible", "eligible"]);
      const scope = getBool(record, ["intent_scope_ok"]);
      const unmentioned = getBool(record, ["unmentioned_ok"]);
      if (guard !== null) flags.push(`guard=${MARK(guard)}`);
      if (coverage !== null) flags.push(`coverage=${MARK(coverage)}`);
      if (eligible !== null) flags.push(`eligible=${MARK(eligible)}`);
      if (scope !== null) flags.push(`scope=${MARK(scope)}`);
      if (unmentioned !== null) flags.push(`unmentioned=${MARK(unmentioned)}`);
      if (id || flags.length > 0) {
        const prefix = id ? `candidate ${id}` : "candidate";
        details.push(flags.length > 0 ? `${prefix}: ${flags.join(" ")}` : prefix);
      }
      const tables = toStringList(getArray(record, ["tables"]));
      if (tables.length > 0) {
        details.push(`tables: ${tables.join(", ")}`);
      }
    }

    const metaParts: string[] = [];
    const connection = getString(stage, ["target_connection"]);
    if (connection) metaParts.push(`target_connection=${connection}`);
    const dialect = getString(stage, ["target_dialect", "dialect"]);
    if (dialect) metaParts.push(`dialect=${dialect}`);
    const success = getBool(stage, ["is_success", "success"]);
    if (success !== null) metaParts.push(`success=${success}`);
    if (metaParts.length > 0) details.push(metaParts.join(", "));

    const failureReason = getString(stage, ["failure_reason"]);
    if (failureReason) details.push(`failure_reason: ${failureReason}`);

    if (details.length === 0) {
      return null;
    }
    return {
      step: step ?? undefined,
      title,
      details,
      status: success === false ? "fail" : "info",
    };
  }

  // 알 수 없는 단계 — 최소한의 요약만
  const summary = getString(stage, ["summary", "description", "message"]);
  if (!summary) {
    return null;
  }
  return { step: step ?? undefined, title, summary, status: "info" };
}

/** stages 가 없는 응답을 위한 방어적 폴백(넓은 키 탐색). */
function buildStepsFromDeepSearch(data: unknown): TargetingTraceStep[] {
  const steps: TargetingTraceStep[] = [];

  const intent = getString(
    deepFindRecord(data, ["query_plan", "queryPlan", "plan"]) ?? getApiResponse(data),
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
    const list = Array.isArray(node) ? node : getArray(asRecord(node), listKeys);
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
  buildSearch("벡터검색", ["vector", "vector_search", "qdrant", "semantic"], ["hits", "results"]);
  buildSearch("키워드검색", ["keyword", "keyword_search", "bm25", "lexical"], ["hits", "results"]);

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
  const targetingResult = deepFindRecord(data, ["targeting_result", "targetingResult"]);

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
  const resultRowCount = getNumber(targetingResult, ["result_row_count", "resultRowCount"]);
  const targetCampaignCount = getNumber(targetingResult, [
    "target_campaign_count",
    "targetCampaignCount",
  ]);

  const trace: TargetingTrace = { steps };

  const query = getString(root, ["query"]) || getString(apiResponse, ["query"]);
  if (query) {
    trace.query = query;
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
