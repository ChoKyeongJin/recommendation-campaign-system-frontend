import { NextResponse } from "next/server";

import {
  type Channel,
  type TargetSegment,
  type TargetSegmentGroup,
} from "@/lib/campaign-data";

const PYTHON_TARGET_SQL_URL =
  process.env.PYTHON_TARGET_SQL_URL ?? "http://127.0.0.1:8000/target-sql";

const channelDescriptions: Record<Channel, string> = {
  LMS: "장문 문자 메시지, 텍스트 중심",
  RCS: "리치 메시지, 버튼 및 이미지 지원",
};

function isChannel(value: unknown): value is Channel {
  return value === "LMS" || value === "RCS";
}

function getPromptForPython(prompt: string, channel: Channel) {
  return `${prompt.trim()}\n발송 채널: ${channel} (${channelDescriptions[channel]})`;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getApiResponse(data: unknown) {
  const record = asRecord(data);
  if (!record) {
    return null;
  }

  const apiResponse = record.api_response;
  if (typeof apiResponse === "string") {
    const parsed = parsePythonResponse(apiResponse);
    return asRecord(parsed);
  }

  return asRecord(apiResponse) ?? record;
}

function getStringValue(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function getNumberValue(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getArrayValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function getPlanRecords(data: unknown) {
  const root = asRecord(data);
  const apiResponse = getApiResponse(data);
  return [
    asRecord(root?.query_plan),
    asRecord(root?.sql_result),
    asRecord(apiResponse?.query_plan),
    asRecord(apiResponse?.sql_result),
  ].filter((record): record is Record<string, unknown> => record !== null);
}

function getCandidateSql(data: unknown) {
  for (const planRecord of getPlanRecords(data)) {
    const candidateList = getArrayValue(planRecord, "candidates");
    const selectedRecord = asRecord(planRecord.selected);
    const candidates = selectedRecord
      ? [selectedRecord, ...candidateList]
      : candidateList;

    for (const candidate of candidates) {
      const candidateRecord = asRecord(candidate);
      const validationRecord = asRecord(candidateRecord?.validation);
      const sql =
        getStringValue(validationRecord, ["safe_sql", "masked_sql", "sql"]) ||
        getStringValue(candidateRecord, ["sql"]);

      if (sql) {
        return sql;
      }
    }
  }

  return "";
}

function findSqlValue(data: unknown): string {
  const record = asRecord(data);
  if (!record) {
    return "";
  }

  const directSql = getStringValue(record, [
    "safe_sql",
    "masked_sql",
    "sql",
    "target_sql",
    "targetSql",
  ]);
  if (directSql) {
    return directSql;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nestedSql = findSqlValue(item);
        if (nestedSql) {
          return nestedSql;
        }
      }
      continue;
    }

    const nestedSql = findSqlValue(value);
    if (nestedSql) {
      return nestedSql;
    }
  }

  return "";
}

function getSqlFromPythonResponse(data: unknown) {
  const apiResponse = getApiResponse(data);
  const databaseExecution = asRecord(apiResponse?.database_execution);
  return (
    getStringValue(databaseExecution, ["executed_sql"]) ||
    getStringValue(apiResponse, ["sql", "target_sql", "targetSql"]) ||
    getCandidateSql(data) ||
    findSqlValue(data)
  );
}

function getTargetingResultRecord(data: unknown) {
  const apiResponse = getApiResponse(data);
  const databaseExecution = asRecord(apiResponse?.database_execution);
  return (
    asRecord(apiResponse?.targeting_result) ??
    asRecord(databaseExecution?.targeting_result) ??
    null
  );
}

function getTotalFromPythonResponse(data: unknown) {
  const apiResponse = getApiResponse(data);
  const targetingResult = getTargetingResultRecord(data);
  const root = asRecord(data);
  const totalKeys = [
    "total",
    "count",
    "target_count",
    "targetCount",
    "row_count",
    "rowCount",
    "result_count",
    "resultCount",
    "user_count",
    "userCount",
    "audience_count",
    "audienceCount",
    "target_customer_count",
    "targetCustomerCount",
  ];

  const total =
    getNumberValue(targetingResult, totalKeys) ??
    getNumberValue(apiResponse, totalKeys) ??
    getNumberValue(root, totalKeys);
  if (total !== null) {
    return total;
  }

  const rows = getArrayValue(apiResponse, "rows").length
    ? getArrayValue(apiResponse, "rows")
    : getArrayValue(root, "rows");
  if (rows.length > 0) {
    return rows.length;
  }

  return null;
}

function getResultRowCountFromPythonResponse(data: unknown) {
  return getNumberValue(getTargetingResultRecord(data), [
    "result_row_count",
    "resultRowCount",
  ]);
}

function getCampaignCountFromPythonResponse(data: unknown) {
  return getNumberValue(getTargetingResultRecord(data), [
    "target_campaign_count",
    "targetCampaignCount",
  ]);
}

function normalizeValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  const text = String(value);
  const labels: Record<string, string> = {
    cart_abandoned: "장바구니 이탈",
    cart_abandoner: "장바구니 이탈 고객",
    "cart_abandoned:fashion": "패션 장바구니 이탈",
    "clicked:coupon": "쿠폰 클릭",
    "20s": "20대",
    "20s_female": "20대 여성",
    repeat_buyer: "재구매 가능 고객",
    price_sensitive: "가격 민감 고객",
    purchase: "구매 유도",
    female: "여성",
    male: "남성",
    high: "높음",
    mid: "중간",
    low: "낮음",
    active: "활성 고객",
    seoul: "서울",
    fashion: "패션",
    beauty: "뷰티",
    travel: "여행",
    app_push: "앱 푸시",
    kakao: "카카오",
    lms: "LMS",
    rcs: "RCS",
  };

  return labels[text.toLowerCase()] ?? text;
}

function uniqueSegments(segments: TargetSegment[]) {
  const seen = new Set<string>();
  return segments.filter((segment) => {
    if (seen.has(segment.label)) {
      return false;
    }

    seen.add(segment.label);
    return true;
  });
}

function getSegmentLabel(path: string, type: string, value: unknown) {
  const normalizedValue = normalizeValue(value);
  if (!normalizedValue) {
    return "";
  }

  if (type === "preferred_channel" || path.includes("preferred_channels")) {
    return `선호 채널: ${normalizedValue}`;
  }

  if (type === "campaign_channel" || path.includes("channels")) {
    return `발송 채널: ${normalizedValue}`;
  }

  if (type === "behavior" || path.includes("behaviors")) {
    return `행동: ${normalizedValue}`;
  }

  if (path.includes("target_segment")) {
    return `타겟 세그먼트: ${normalizedValue}`;
  }

  if (path.includes("objective")) {
    return `캠페인 목적: ${normalizedValue}`;
  }

  if (path.includes("lifecycle")) {
    return `라이프사이클: ${normalizedValue}`;
  }

  if (path.includes("interests")) {
    return `관심사: ${normalizedValue}`;
  }

  return `${path || type}: ${normalizedValue}`;
}

function getExplicitSegments(data: unknown) {
  const apiResponse = getApiResponse(data);
  const segments = apiResponse?.segments;
  if (!Array.isArray(segments)) {
    return [];
  }

  const normalized = segments.flatMap((segment) => {
    if (!segment || typeof segment !== "object") {
      return [];
    }

    const record = segment as Record<string, unknown>;
    const label = record.label ?? record.name;
    const count = getNumberValue(record, [
      "count",
      "total",
      "target_count",
      "targetCount",
    ]);

    return typeof label === "string"
      ? [{ label, ...(count !== null ? { count } : {}) }]
      : [];
  });

  return normalized;
}

function getSegmentsFromQueryPlan(data: unknown, sql: string) {
  const segments: TargetSegment[] = [];

  for (const planRecord of getPlanRecords(data)) {
    const targetUser = asRecord(planRecord.target_user);
    const campaignConstraints = asRecord(planRecord.campaign_constraints);

    for (const channel of getArrayValue(targetUser, "preferred_channels")) {
      segments.push({ label: `선호 채널: ${normalizeValue(channel)}` });
    }

    for (const channel of getArrayValue(campaignConstraints, "channels")) {
      segments.push({ label: `발송 채널: ${normalizeValue(channel)}` });
    }

    for (const behavior of getArrayValue(targetUser, "behaviors")) {
      segments.push({ label: `행동: ${normalizeValue(behavior)}` });
    }

    for (const lifecycle of getArrayValue(targetUser, "lifecycle")) {
      segments.push({ label: `라이프사이클: ${normalizeValue(lifecycle)}` });
    }

    for (const interest of getArrayValue(targetUser, "interests")) {
      segments.push({ label: `관심사: ${normalizeValue(interest)}` });
    }

    const ageMin = targetUser?.age_min;
    const ageMax = targetUser?.age_max;
    if (typeof ageMin === "number" || typeof ageMax === "number") {
      segments.push({
        label: `연령: ${typeof ageMin === "number" ? ageMin : ""}~${typeof ageMax === "number" ? ageMax : ""}세`,
      });
    }

    const gender = normalizeValue(targetUser?.gender);
    if (gender) {
      segments.push({ label: `성별: ${gender}` });
    }

    const objective = normalizeValue(campaignConstraints?.objective);
    if (objective) {
      segments.push({ label: `캠페인 목적: ${objective}` });
    }

    for (const token of getArrayValue(planRecord, "condition_tokens")) {
      const tokenRecord = asRecord(token);
      const label = getSegmentLabel(
        String(tokenRecord?.path ?? ""),
        String(tokenRecord?.type ?? ""),
        tokenRecord?.value,
      );
      if (label) {
        segments.push({ label });
      }
    }

    for (const condition of getArrayValue(planRecord, "required_conditions")) {
      const conditionRecord = asRecord(condition);
      const label = getSegmentLabel(
        String(conditionRecord?.path ?? ""),
        "",
        conditionRecord?.value,
      );
      if (label) {
        segments.push({ label });
      }
    }
  }

  const sqlPatterns: Array<[RegExp, string]> = [
    [/upc\.preferred_channel\s*=\s*'([^']+)'/i, "선호 채널"],
    [/cc\.channel\s*=\s*'([^']+)'/i, "발송 채널"],
    [/urb\.behavior\s+(?:LIKE|=)\s*'([^']+)/i, "행동"],
    [/ts\.target_segment\s*=\s*'([^']+)'/i, "타겟 세그먼트"],
  ];

  for (const [pattern, label] of sqlPatterns) {
    const match = sql.match(pattern);
    if (match?.[1]) {
      segments.push({ label: `${label}: ${normalizeValue(match[1])}` });
    }
  }

  return uniqueSegments(segments);
}

function getSegmentsFromPythonResponse(data: unknown, sql: string) {
  const explicitSegments = getExplicitSegments(data);
  return explicitSegments.length > 0
    ? explicitSegments
    : getSegmentsFromQueryPlan(data, sql);
}

function getSegmentCompositionRecord(data: unknown) {
  const apiResponse = getApiResponse(data);
  const databaseExecution = asRecord(apiResponse?.database_execution);
  return (
    asRecord(apiResponse?.segment_composition) ??
    asRecord(databaseExecution?.segment_composition) ??
    null
  );
}

function getCompositionItemLabel(
  item: Record<string, unknown>,
  groupKey: string,
) {
  if (groupKey === "campaigns") {
    const name = getStringValue(item, ["name", "title", "campaign_id"]);
    const category = normalizeValue(item.category);
    const offer = getStringValue(item, ["offer"]);
    return [name, category, offer].filter(Boolean).join(" / ");
  }

  return normalizeValue(item.value);
}

function getSegmentPresentationRecord(data: unknown) {
  const apiResponse = getApiResponse(data);
  const databaseExecution = asRecord(apiResponse?.database_execution);
  return (
    asRecord(apiResponse?.segment_presentation) ??
    asRecord(databaseExecution?.segment_presentation) ??
    null
  );
}

function buildSegmentGroupsByKey(data: unknown) {
  const composition = getSegmentCompositionRecord(data);
  const groups = new Map<string, TargetSegmentGroup>();
  if (!composition) {
    return groups;
  }

  const groupTitles: Record<string, string> = {
    gender: "성별",
    age_band: "연령대",
    region: "지역",
    lifecycle: "라이프사이클",
    price_sensitivity: "가격 민감도",
    predicted_ltv_segment: "예측 LTV",
    preferred_channels: "선호 채널",
    behaviors: "고객 행동",
    interests: "관심사",
    campaigns: "추천 캠페인",
    campaign_categories: "캠페인 카테고리",
    campaign_channels: "캠페인 채널",
    campaign_target_segments: "캠페인 타겟 세그먼트",
  };

  for (const [key, title] of Object.entries(groupTitles)) {
    const items = getArrayValue(composition, key);
    const segments = items.flatMap((item) => {
      const record = asRecord(item);
      if (!record) {
        return [];
      }

      const label = getCompositionItemLabel(record, key);
      const count = getNumberValue(record, ["count"]);
      return label ? [{ label, ...(count !== null ? { count } : {}) }] : [];
    });

    if (segments.length > 0) {
      groups.set(key, { key, title, segments });
    }
  }

  return groups;
}

/**
 * segment_presentation(백엔드가 질문 기준으로 판단한 relevant/hidden)을 이용해
 * 화면에 기본 노출할 그룹과 접어둘 그룹을 분리한다.
 * presentation 이 없으면(구버전 Python) 기존처럼 전체를 노출한다.
 */
function getSegmentGroupsFromPythonResponse(data: unknown): {
  segmentGroups: TargetSegmentGroup[];
  hiddenSegmentGroups: TargetSegmentGroup[];
} {
  const groupsByKey = buildSegmentGroupsByKey(data);
  const presentation = getSegmentPresentationRecord(data);

  if (!presentation) {
    return {
      segmentGroups: [...groupsByKey.values()],
      hiddenSegmentGroups: [],
    };
  }

  const usedKeys = new Set<string>();

  const segmentGroups = getArrayValue(presentation, "relevant_groups").flatMap(
    (entry) => {
      const record = asRecord(entry);
      const key = getStringValue(record, ["key"]);
      const group = key ? groupsByKey.get(key) : undefined;
      if (!group) {
        return [];
      }

      usedKeys.add(key);
      const priority = getNumberValue(record, ["priority"]);
      const reason = getStringValue(record, ["reason"]);
      return [
        {
          ...group,
          ...(priority !== null ? { priority } : {}),
          ...(reason ? { reason } : {}),
        },
      ];
    },
  );

  const hiddenSegmentGroups = getArrayValue(
    presentation,
    "hidden_group_keys",
  ).flatMap((entry) => {
    const record = asRecord(entry);
    const key = getStringValue(record, ["key"]);
    const group = key ? groupsByKey.get(key) : undefined;
    if (!group) {
      return [];
    }

    usedKeys.add(key);
    return [group];
  });

  // presentation 이 다루지 않은 잔여 그룹은 보수적으로 접어둔다.
  for (const [key, group] of groupsByKey) {
    if (!usedKeys.has(key)) {
      hiddenSegmentGroups.push(group);
    }
  }

  return { segmentGroups, hiddenSegmentGroups };
}

function getNormalizedPromptFromPythonResponse(data: unknown) {
  const apiResponse = getApiResponse(data);
  const normalized = getStringValue(apiResponse, [
    "normalized_query",
    "normalizedQuery",
  ]);
  if (!normalized) {
    return "";
  }

  // 프론트가 파이썬 호출용으로 덧붙인 "발송 채널: ..." 접미어는 표시에서 제외한다.
  return normalized.replace(/\s*발송\s*채널\s*:[\s\S]*$/, "").trim();
}

// 백엔드가 재작성 시 함께 뽑아주는 "오디언스만" 담은 타겟팅 라벨. offer(쿠폰)·행동·"캠페인"·발송채널이
// 빠진 값이라 화면 "타겟팅 프롬프트"에 이걸 우선 쓴다. 값이 없으면 normalized_query 로 폴백한다.
function getTargetingLabelFromPythonResponse(data: unknown) {
  const apiResponse = getApiResponse(data);
  return getStringValue(apiResponse, ["targeting_label", "targetingLabel"]).trim();
}

function getSampleRowsFromPythonResponse(data: unknown) {
  const targetingResult = getTargetingResultRecord(data);
  const sampleRows = getArrayValue(targetingResult, "sample_rows");

  return sampleRows.flatMap((row) => {
    const record = asRecord(row);
    return record ? [record] : [];
  });
}

function getCampaignIdFromPythonResponse(data: unknown) {
  const apiResponse = getApiResponse(data);
  const targetingResult = getTargetingResultRecord(data);
  const composition = getSegmentCompositionRecord(data);
  const campaign = getArrayValue(composition, "campaigns").flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  })[0];
  const sampleRow = getSampleRowsFromPythonResponse(data)[0] ?? null;

  return (
    getStringValue(targetingResult, [
      "campaign_id",
      "campaignId",
      "target_campaign_id",
      "targetCampaignId",
    ]) ||
    getStringValue(apiResponse, [
      "campaign_id",
      "campaignId",
      "target_campaign_id",
      "targetCampaignId",
    ]) ||
    getStringValue(campaign ?? null, ["campaign_id", "campaignId", "id"]) ||
    getStringValue(sampleRow, ["campaign_id", "campaignId"])
  );
}

// api_response.confidence(구조화 신뢰도)를 그대로 통과시킨다. 검증 SQL이 없으면 백엔드가 null 을 준다.
function getConfidenceFromPythonResponse(data: unknown) {
  const apiResponse = getApiResponse(data);
  const confidence = asRecord(apiResponse?.confidence);
  if (!confidence || typeof confidence.overall_score !== "number") {
    return null;
  }
  return confidence;
}

function parsePythonResponse(rawText: string) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const prompt =
    body && typeof body.prompt === "string" ? body.prompt.trim() : "";
  const channel = body && isChannel(body.channel) ? body.channel : null;

  if (!prompt || !channel) {
    return NextResponse.json(
      { error: "prompt와 channel이 필요합니다." },
      { status: 400 },
    );
  }

  const pythonPrompt = getPromptForPython(prompt, channel);

  try {
    const pythonResponse = await fetch(PYTHON_TARGET_SQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: pythonPrompt }),
      cache: "no-store",
    });

    const rawText = await pythonResponse.text();
    const data = parsePythonResponse(rawText);

    if (!pythonResponse.ok) {
      return NextResponse.json(
        {
          error: "Python 타겟팅 API 호출에 실패했습니다.",
          detail: data ?? rawText,
        },
        { status: 502 },
      );
    }

    const sql = getSqlFromPythonResponse(data);
    const { segmentGroups, hiddenSegmentGroups } =
      getSegmentGroupsFromPythonResponse(data);

    return NextResponse.json({
      campaignId: getCampaignIdFromPythonResponse(data),
      total: getTotalFromPythonResponse(data),
      resultRowCount: getResultRowCountFromPythonResponse(data),
      targetCampaignCount: getCampaignCountFromPythonResponse(data),
      segments: getSegmentsFromPythonResponse(data, sql),
      segmentGroups,
      hiddenSegmentGroups,
      normalizedPrompt: getNormalizedPromptFromPythonResponse(data),
      targetingLabel: getTargetingLabelFromPythonResponse(data),
      sql,
      message: getStringValue(getApiResponse(data), ["message"]),
      sampleRows: getSampleRowsFromPythonResponse(data),
      confidence: getConfidenceFromPythonResponse(data),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: "Python 타겟팅 API를 호출할 수 없습니다.", detail: message },
      { status: 502 },
    );
  }
}
