import { NextResponse } from "next/server";

import {
  type CampaignCtrDisplayValue,
  type CampaignCtrRuleEvaluation,
  type CampaignCtrScoreBreakdown,
  type CampaignCtrScoreSummary,
  type CampaignCtrScoreValue,
  type CampaignCtrVariantScore,
} from "@/lib/campaign-data";

const PYTHON_CTR_SCORE_URL =
  process.env.PYTHON_CTR_SCORE_URL ?? "http://127.0.0.1:8000/ai/ctr/score";

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
  if (Array.isArray(data)) {
    return data;
  }

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

function getBooleanValue(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
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

  return undefined;
}

function normalizeScoreValue(
  value: unknown,
  fallbackLabel: string,
): CampaignCtrScoreValue | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const displayValue = getStringValue(record, [
    "displayValue",
    "display_value",
    "value",
    "score",
  ]);
  if (!displayValue) {
    return null;
  }

  return {
    key: getStringValue(record, ["key"]),
    label: getStringValue(record, ["label", "name", "title"]) || fallbackLabel,
    displayValue,
    reason: getStringValue(record, ["reason", "description"]),
  };
}

function getArrayValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function normalizeDisplayValue(value: unknown): CampaignCtrDisplayValue | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const displayValue = getStringValue(record, ["displayValue", "display_value"]);
  return displayValue ? { displayValue } : undefined;
}

function normalizeScoreSummary(value: unknown): CampaignCtrScoreSummary | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    appliedRuleCount: getNumberValue(record, [
      "appliedRuleCount",
      "applied_rule_count",
    ]),
    notAppliedRuleCount: getNumberValue(record, [
      "notAppliedRuleCount",
      "not_applied_rule_count",
    ]),
    appliedAdjustmentTotal: normalizeDisplayValue(
      record.appliedAdjustmentTotal ?? record.applied_adjustment_total,
    ),
    calibrationAdjustmentTotal: normalizeDisplayValue(
      record.calibrationAdjustmentTotal ?? record.calibration_adjustment_total,
    ),
    totalDeltaFromBase: normalizeDisplayValue(
      record.totalDeltaFromBase ?? record.total_delta_from_base,
    ),
  };
}

function normalizeRuleEvaluation(value: unknown): CampaignCtrRuleEvaluation | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return {
    key: getStringValue(record, ["key"]),
    applied: getBooleanValue(record, ["applied"]),
    appliedDelta: normalizeDisplayValue(record.appliedDelta ?? record.applied_delta),
    reason: getStringValue(record, ["reason", "description"]),
  };
}

function normalizeScoreBreakdown(value: unknown): CampaignCtrScoreBreakdown | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const rawBullets = getArrayValue(record, "explanationBullets").length > 0
    ? getArrayValue(record, "explanationBullets")
    : getArrayValue(record, "explanation_bullets");
  const rawRuleEvaluations = getArrayValue(record, "ruleEvaluations").length > 0
    ? getArrayValue(record, "ruleEvaluations")
    : getArrayValue(record, "rule_evaluations");
  const explanationBullets = rawBullets.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  const ruleEvaluations = rawRuleEvaluations
    .map((item) => normalizeRuleEvaluation(item))
    .filter((item): item is CampaignCtrRuleEvaluation => item !== null);

  return {
    explanationBullets,
    ruleEvaluations,
  };
}

function formatProbability(value: number) {
  const percentage = value >= 0 && value <= 1 ? value * 100 : value;
  return `${percentage.toFixed(2)}%`;
}

function getCtrDisplayNumber(value: string) {
  const normalized = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? Math.abs(normalized) : 0;
}

function normalizeVariantScore(value: unknown): CampaignCtrVariantScore | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const variantCode = getStringValue(record, [
    "variantCode",
    "variant_code",
    "code",
  ]);
  const displayValue = getStringValue(record, ["displayValue", "display_value"]);
  const predictedCtr = asRecord(record.predictedCtr) ?? asRecord(record.predicted_ctr);
  const predictedCtrDisplayValue = getStringValue(predictedCtr, [
    "displayValue",
    "display_value",
  ]);
  const predictedClickProbability = getNumberValue(record, [
    "predictedClickProbability",
    "predicted_click_probability",
    "predicted_ctr",
    "score",
  ]);

  if (
    !variantCode ||
    (!displayValue && !predictedCtrDisplayValue && predictedClickProbability === undefined)
  ) {
    return null;
  }

  return {
    variantCode,
    rank: getNumberValue(record, ["rank"]),
    name: getStringValue(record, ["name", "title", "messageName"]) ||
      `시안 ${variantCode}`,
    isSelected: getBooleanValue(record, ["isSelected", "is_selected"]),
    predictedClickProbability,
    displayValue:
      displayValue ||
      predictedCtrDisplayValue ||
      (predictedClickProbability === undefined
        ? "-"
        : formatProbability(predictedClickProbability)),
    deltaVsBest: normalizeDisplayValue(record.deltaVsBest ?? record.delta_vs_best),
    scoreSummary: normalizeScoreSummary(record.scoreSummary ?? record.score_summary),
    scoreBreakdown: normalizeScoreBreakdown(
      record.scoreBreakdown ?? record.score_breakdown,
    ),
  };
}

function normalizeVariantScores(data: unknown) {
  const response = getApiResponse(data);
  const raw = asRecord(response)?.raw ?? response;
  const candidates = Array.isArray(raw)
    ? raw
    : getArrayValue(asRecord(raw), "variantScores").length > 0
      ? getArrayValue(asRecord(raw), "variantScores")
      : getArrayValue(asRecord(raw), "variant_scores");

  return candidates
    .map((item) => normalizeVariantScore(item))
    .filter((item): item is CampaignCtrVariantScore => item !== null);
}

function getSelectedBreakdown(response: Record<string, unknown>) {
  const selectedVariantCode = getStringValue(response, [
    "selectedVariantCode",
    "selected_variant_code",
  ]);
  const scoreBreakdowns =
    asRecord(response.scoreBreakdowns) ?? asRecord(response.score_breakdowns);

  return (
    asRecord(response.selectedScoreBreakdown) ??
    asRecord(response.selected_score_breakdown) ??
    (selectedVariantCode ? asRecord(scoreBreakdowns?.[selectedVariantCode]) : null)
  );
}

function getFirstResultBreakdown(response: Record<string, unknown>) {
  for (const result of getArrayValue(response, "results")) {
    const resultRecord = asRecord(result);
    if (!resultRecord) {
      continue;
    }

    const breakdown = getSelectedBreakdown(resultRecord);
    if (breakdown) {
      return breakdown;
    }
  }

  return null;
}

function getScoreSource(data: unknown) {
  const response = getApiResponse(data);
  const responseRecord = asRecord(response);
  const raw = asRecord(responseRecord?.raw) ?? asRecord(data);
  const sourceRoot = asRecord(raw?.raw) ?? raw;
  if (!sourceRoot) {
    return null;
  }

  const selectedBreakdown = getSelectedBreakdown(sourceRoot);
  const firstResultBreakdown = getFirstResultBreakdown(sourceRoot);
  const directScore =
    asRecord(sourceRoot.ctrScore) ??
    asRecord(sourceRoot.ctr_score) ??
    asRecord(sourceRoot.score) ??
    sourceRoot;

  return selectedBreakdown ?? firstResultBreakdown ?? directScore;
}

function normalizeCtrScore(data: unknown) {
  const variantScores = normalizeVariantScores(data);
  if (variantScores.length > 0) {
    const selected =
      variantScores.find((score) => score.isSelected) ??
      variantScores.find((score) => score.rank === 1) ??
      [...variantScores].sort(
        (a, b) =>
          getCtrDisplayNumber(b.displayValue) - getCtrDisplayNumber(a.displayValue),
      )[0];

    return {
      title: "시안별 예측 클릭률",
      selectedVariantCode: selected?.variantCode,
      variantScores,
      predictedCtr: selected
        ? {
            label: "선택 시안 CTR",
            displayValue: selected.displayValue,
          }
        : undefined,
    };
  }

  const score = getScoreSource(data);
  if (!score) {
    return null;
  }

  const display = asRecord(score.display) ?? score;

  const baseScore = normalizeScoreValue(
    display.baseScore ?? display.base_score ?? score.baseScore ?? score.base_score,
    "Base Score",
  );
  const predictedCtr = normalizeScoreValue(
    display.predictedCtr ??
      display.predicted_ctr ??
      score.predictedCtr ??
      score.predicted_ctr,
    "예측 CTR",
  );

  if (!baseScore || !predictedCtr) {
    return null;
  }

  const rawAdjustments = display.adjustments ?? score.adjustments ?? score.factors ?? [];
  const adjustments = (Array.isArray(rawAdjustments) ? rawAdjustments : [])
    .map((item) => normalizeScoreValue(item, "보정 요인"))
    .filter((item): item is CampaignCtrScoreValue => item !== null);
  const rawCalibrationAdjustments =
    display.calibrationAdjustments ??
    display.calibration_adjustments ??
    score.calibrationAdjustments ??
    score.calibration_adjustments ??
    [];
  const calibrationAdjustments = (
    Array.isArray(rawCalibrationAdjustments) ? rawCalibrationAdjustments : []
  )
    .map((item) => normalizeScoreValue(item, "보정"))
    .filter((item): item is CampaignCtrScoreValue => item !== null);

  return {
    title: getStringValue(display, ["title"]) || "클릭률 분석 근거",
    selectedVariantCode: getStringValue(score, [
      "variantCode",
      "variant_code",
      "selectedVariantCode",
      "selected_variant_code",
    ]),
    modelVersion: getStringValue(score, ["modelVersion", "model_version"]),
    baseScore,
    adjustments,
    calibrationAdjustments,
    predictedCtr,
  };
}

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  if (!requestBody) {
    return NextResponse.json(
      { error: "클릭률 근거 요청 바디가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const pythonResponse = await fetch(PYTHON_CTR_SCORE_URL, {
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
          error: "Python 클릭률 근거 API 호출에 실패했습니다.",
          detail: data ?? rawText,
        },
        { status: 502 },
      );
    }

    const score = normalizeCtrScore(data);
    return NextResponse.json(score ?? { raw: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      {
        error: "Python 클릭률 근거 API를 호출할 수 없습니다.",
        detail: message,
      },
      { status: 502 },
    );
  }
}