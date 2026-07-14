import { NextResponse } from "next/server";

import { type CampaignMessage, type Channel } from "@/lib/campaign-data";

const PYTHON_CHANNEL_MESSAGES_URL =
  process.env.PYTHON_CHANNEL_MESSAGES_URL ??
  "http://localhost:8000/channel-messages";

function isChannel(value: unknown): value is Channel {
  return value === "LMS" || value === "RCS";
}

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

function getMessagesRecord(data: unknown) {
  const record = asRecord(data);
  const apiResponse = asRecord(record?.api_response);
  return apiResponse ?? record;
}

function getValidationRecord(data: unknown) {
  const response = getMessagesRecord(data);
  return (
    asRecord(response?.message_generation_validation) ??
    asRecord(response?.validation)
  );
}

function getVariantTitle(variant: string, index: number) {
  const titles: Record<string, string> = {
    benefit_emphasis: "혜택 중심 메시지",
    urgency_emphasis: "긴급성 강조 메시지",
    emotion_emphasis: "감성 강조 메시지",
    information_emphasis: "정보 전달 메시지",
    premium_emphasis: "프리미엄 메시지",
  };

  return titles[variant] ?? `추천 메시지 ${index + 1}`;
}

function getVariantTone(variant: string) {
  const tones: Record<string, string> = {
    benefit_emphasis: "혜택 강조형",
    urgency_emphasis: "긴급성 강조형",
    emotion_emphasis: "감성 강조형",
    information_emphasis: "정보 전달형",
    premium_emphasis: "프리미엄형",
  };

  return tones[variant] ?? (variant || "추천형");
}

function getMessageBody(record: Record<string, unknown>) {
  const body = getStringValue(record, [
    "message_text",
    "messageText",
    "text",
    "body",
    "content",
    "message",
    "copy",
  ]);

  if (body) {
    return body;
  }

  const description = getStringValue(record, ["description", "desc"]);
  return description;
}

function getMessageButtons(record: Record<string, unknown> | null) {
  const buttons = record?.buttons;

  if (!Array.isArray(buttons)) {
    return undefined;
  }

  const normalizedButtons = buttons.flatMap((button) => {
    const buttonRecord = asRecord(button);
    const name = getStringValue(buttonRecord, [
      "name",
      "label",
      "title",
      "text",
    ]);

    if (!name) {
      return [];
    }

    const url = getStringValue(buttonRecord, [
      "url",
      "href",
      "link",
      "landing_url",
    ]);

    return [
      {
        name,
        ...(url ? { url } : {}),
      },
    ];
  });

  return normalizedButtons.length > 0 ? normalizedButtons : undefined;
}

function getRecordArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
}

function getFirstStringFromRecords(
  records: Record<string, unknown>[],
  keys: string[],
) {
  for (const record of records) {
    const value = getStringValue(record, keys);
    if (value) {
      return value;
    }
  }

  return "";
}

function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    baby: "육아용품",
    beauty: "뷰티",
    fashion: "패션",
    food: "식품",
    grocery: "장보기",
    home_living: "리빙",
    electronics: "전자제품",
    sports: "스포츠",
    travel: "여행",
    pet: "반려동물",
  };

  return labels[category] ?? category;
}

function getProductName(offer: string, category: string) {
  const productName = offer
    .replace(/\s*\d+(?:\.\d+)?\s*%.*$/, "")
    .replace(/\s+(할인|쿠폰|혜택|증정|무료.*)$/, "")
    .replace(/^.*(?:고객에게|고객 대상|고객|에게)\s*/, "")
    .trim();

  return productName || getCategoryLabel(category) || "추천 상품";
}

function getOfferText(offer: string, prompt: string, productName: string) {
  if (offer) {
    return offer;
  }

  return prompt.includes("할인")
    ? `${productName} 할인 혜택`
    : `${productName} 혜택`;
}

function getFallbackMessagesFromTargeting(
  response: Record<string, unknown> | null,
  channel: Channel,
  prompt: string,
): CampaignMessage[] {
  const targetingResult =
    asRecord(response?.targeting_result) ?? asRecord(response?.targetingResult);
  const segmentComposition =
    asRecord(response?.segment_composition) ??
    asRecord(response?.segmentComposition);
  const sampleRows = getRecordArray(
    targetingResult?.sample_rows ?? targetingResult?.sampleRows,
  );
  const campaigns = getRecordArray(segmentComposition?.campaigns);
  const offer =
    getFirstStringFromRecords(sampleRows, ["offer", "campaign_offer"]) ||
    getFirstStringFromRecords(campaigns, ["offer"]);
  const category =
    getFirstStringFromRecords(sampleRows, ["category", "campaign_category"]) ||
    getFirstStringFromRecords(campaigns, ["category"]);
  const campaignName = getFirstStringFromRecords(campaigns, ["name"]);

  if (!offer && !category && !campaignName && !prompt) {
    return [];
  }

  const categoryLabel = getCategoryLabel(category);
  const productName = getProductName(offer || prompt, category);
  const offerText = getOfferText(offer, prompt, productName);
  const contextName = campaignName || categoryLabel || productName;
  const templates: Omit<CampaignMessage, "id">[] = [
    {
      title: `(광고) ${productName} 혜택`,
      body: `(광고) 장바구니에 남겨둔 ${productName}를 ${offerText}으로 다시 만나보세요. 지금 확인하고 혜택을 놓치지 마세요. 무료 수신거부`,
      tone: "혜택 강조형",
      variant: "benefit_emphasis",
    },
    {
      title: `(광고) ${productName} 마감임박`,
      body: `(광고) ${offerText} 혜택이 준비되었습니다. 재고 소진 전 ${productName} 상품을 확인해 보세요. 무료 수신거부`,
      tone: "긴급성 강조형",
      variant: "urgency_emphasis",
    },
    {
      title: `(광고) ${categoryLabel || productName} 추천`,
      body: `(광고) ${contextName} 고객님께 맞춘 ${offerText} 안내입니다. 필요한 순간에 다시 준비해 드렸어요. 무료 수신거부`,
      tone: "감성 강조형",
      variant: "emotion_emphasis",
    },
  ];

  return templates.map((message, index) => ({
    id: index + 1,
    ...message,
    ...(channel === "RCS" ? { buttons: [{ name: "혜택보기" }] } : {}),
  }));
}

function getMessagesFromPythonResponse(data: unknown): CampaignMessage[] {
  const response = getMessagesRecord(data);
  const validation = getValidationRecord(data);
  const responseMessages = response?.messages;
  const validationMessages = validation?.messages;
  const messages =
    Array.isArray(responseMessages) && responseMessages.length > 0
      ? responseMessages
      : validationMessages;

  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.flatMap((message, index) => {
    const record = asRecord(message);
    if (!record) {
      return [];
    }

    const variant = getStringValue(record, ["variant", "emphasis_type"]);
    const body = getMessageBody(record);
    if (!body) {
      return [];
    }

    const validationRecord = Array.isArray(validationMessages)
      ? asRecord(validationMessages[index])
      : null;
    const buttons =
      getMessageButtons(record) ?? getMessageButtons(validationRecord);

    return [
      {
        id: index + 1,
        title:
          getStringValue(record, ["title", "headline", "name"]) ||
          getVariantTitle(variant, index),
        body,
        tone:
          getStringValue(record, ["tone", "brand_tone", "brandTone"]) ||
          getVariantTone(variant),
        variant,
        ...(buttons ? { buttons } : {}),
      },
    ];
  });
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

  try {
    const pythonResponse = await fetch(PYTHON_CHANNEL_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        prompt,
        message_channel: channel.toLowerCase(),
      }),
      cache: "no-store",
    });

    const rawText = await pythonResponse.text();
    const data = parsePythonResponse(rawText);

    if (!pythonResponse.ok) {
      return NextResponse.json(
        {
          error: "Python 메시지 추천 API 호출에 실패했습니다.",
          detail: data ?? rawText,
        },
        { status: 502 },
      );
    }

    const response = getMessagesRecord(data);
    const validation = getValidationRecord(data);
    const messages = getMessagesFromPythonResponse(data);
    const targetingResult =
      asRecord(response?.targeting_result) ??
      asRecord(response?.targetingResult);
    const segmentComposition =
      asRecord(response?.segment_composition) ??
      asRecord(response?.segmentComposition);
    const responseMessageCount =
      typeof response?.message_count === "number"
        ? response.message_count
        : typeof response?.messageCount === "number"
          ? response.messageCount
          : 0;
    const normalizedMessages =
      messages.length > 0
        ? messages
        : getFallbackMessagesFromTargeting(response, channel, prompt);

    return NextResponse.json({
      status: getStringValue(response, ["status"]),
      channel: getStringValue(response, ["channel"]) || channel.toLowerCase(),
      messages: normalizedMessages,
      messageCount:
        normalizedMessages.length > 0
          ? normalizedMessages.length
          : responseMessageCount,
      sql: getStringValue(response, ["sql"]),
      targetingResult,
      segmentComposition,
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      {
        error: "Python 메시지 추천 API를 호출할 수 없습니다.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
