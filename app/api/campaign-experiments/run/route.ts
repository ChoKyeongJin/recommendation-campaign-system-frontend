import { NextResponse } from "next/server";

import { type MessagePerformance } from "@/lib/campaign-data";

const PYTHON_CAMPAIGN_EXPERIMENTS_RUN_URL =
  process.env.PYTHON_CAMPAIGN_EXPERIMENTS_RUN_URL ??
  "http://127.0.0.1:8000/campaign-experiments/run";

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
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

function getApiResponse(data: unknown) {
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

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getArrayValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function normalizePercent(value: number) {
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return +percent.toFixed(1);
}

const ctrKeys = [
  "ctr",
  "predicted_ctr",
  "predictedCtr",
  "click_through_rate",
  "clickThroughRate",
  "expected_ctr",
  "expectedCtr",
  "score",
  "probability",
];

function hasCtrValue(record: Record<string, unknown>) {
  return getNumberValue(record, ctrKeys) !== null;
}

function getVariantRecordsFromMap(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([code, candidate]) => {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return [{ code, ctr: candidate }];
    }

    const candidateRecord = asRecord(candidate);
    if (!candidateRecord || !hasCtrValue(candidateRecord)) {
      return [];
    }

    return [{ code, ...candidateRecord }];
  });
}

function collectVariantRecords(value: unknown, depth = 0): unknown[] {
  if (depth > 5) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const itemRecord = asRecord(item);
      if (itemRecord && hasCtrValue(itemRecord)) {
        return [itemRecord];
      }

      return collectVariantRecords(item, depth + 1);
    });
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  if (hasCtrValue(record)) {
    return [record];
  }

  const mappedRecords = [
    "ctr_by_variant",
    "ctrByVariant",
    "predicted_ctr_by_variant",
    "predictedCtrByVariant",
    "variant_ctr",
    "variantCtr",
    "variant_scores",
    "variantScores",
  ].flatMap((key) => getVariantRecordsFromMap(record[key]));

  return [
    ...mappedRecords,
    ...Object.values(record).flatMap((child) =>
      collectVariantRecords(child, depth + 1),
    ),
  ];
}

function getVariantRecords(data: unknown) {
  const root = asRecord(data);
  const apiResponse = getApiResponse(data);
  const nestedRecords = [
    root,
    apiResponse,
    asRecord(root?.analysis),
    asRecord(root?.experiment),
    asRecord(root?.result),
    asRecord(apiResponse?.analysis),
    asRecord(apiResponse?.experiment),
    asRecord(apiResponse?.result),
  ];
  const arrayKeys = [
    "performance",
    "variant_performance",
    "variantPerformance",
    "variant_results",
    "variantResults",
    "predictions",
    "results",
    "variants",
  ];

  for (const record of nestedRecords) {
    for (const key of arrayKeys) {
      const values = getArrayValue(record, key);
      if (values.some((value) => asRecord(value))) {
        return values;
      }

      const mappedValues = getVariantRecordsFromMap(record?.[key]);
      if (mappedValues.length > 0) {
        return mappedValues;
      }
    }
  }

  return collectVariantRecords(data);
}

function getRequestVariant(
  requestVariants: Record<string, unknown>[],
  variant: Record<string, unknown>,
  index: number,
) {
  const code = getStringValue(variant, ["code", "variant_code", "variantCode"]);
  if (code) {
    const matched = requestVariants.find(
      (requestVariant) =>
        getStringValue(requestVariant, ["code"]).toLowerCase() ===
        code.toLowerCase(),
    );

    if (matched) {
      return matched;
    }
  }

  return requestVariants[index] ?? null;
}

function normalizePerformance(
  data: unknown,
  requestBody: unknown,
): MessagePerformance[] {
  const requestRecord = asRecord(requestBody);
  const requestVariants = getArrayValue(requestRecord, "variants").flatMap(
    (variant) => {
      const record = asRecord(variant);
      return record ? [record] : [];
    },
  );
  const userCount = getArrayValue(requestRecord, "userIds").length;

  return getVariantRecords(data).flatMap((variant, index) => {
    const record = asRecord(variant);
    if (!record) {
      return [];
    }

    const ctrValue = getNumberValue(record, ctrKeys);
    if (ctrValue === null) {
      return [];
    }

    const requestVariant = getRequestVariant(requestVariants, record, index);
    const sent =
      getNumberValue(record, [
        "sent",
        "impressions",
        "assigned_user_count",
        "assignedUserCount",
        "assignment_count",
        "assignmentCount",
        "sample_size",
        "sampleSize",
        "target_count",
        "targetCount",
      ]) ?? userCount;
    const ctr = normalizePercent(ctrValue);
    const clicks =
      getNumberValue(record, [
        "clicks",
        "expected_clicks",
        "expectedClicks",
        "predicted_clicks",
        "predictedClicks",
      ]) ?? Math.round((sent * ctr) / 100);

    return [
      {
        id: index + 1,
        title:
          getStringValue(record, [
            "title",
            "name",
            "variant_name",
            "variantName",
          ]) ||
          getStringValue(requestVariant, ["name", "title"]) ||
          getStringValue(record, ["code", "variant_code", "variantCode"]) ||
          `시안 ${index + 1}`,
        sent,
        clicks,
        ctr,
      },
    ];
  });
}

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  if (!requestBody) {
    return NextResponse.json(
      { error: "campaign experiment 요청 바디가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const pythonResponse = await fetch(PYTHON_CAMPAIGN_EXPERIMENTS_RUN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    const rawText = await pythonResponse.text();
    const data = parsePythonResponse(rawText);

    if (!pythonResponse.ok) {
      return NextResponse.json(
        {
          error: "Python 클릭률 예측 API 호출에 실패했습니다.",
          detail: data ?? rawText,
        },
        { status: 502 },
      );
    }

    const response = getApiResponse(data);
    const responseRecord = asRecord(response);

    return NextResponse.json({
      ...(responseRecord ?? { raw: data }),
      performance: normalizePerformance(data, requestBody),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      {
        error: "Python 클릭률 예측 API를 호출할 수 없습니다.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
