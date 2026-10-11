import { NextRequest, NextResponse } from "next/server";
import {
  createSettingsSession, settingsCredentials, settingsPasswordMatches, settingsRequestIsSameOrigin,
  validSettingsSession, SETTINGS_SESSION_COOKIE, SETTINGS_SESSION_SECONDS,
} from "@/lib/settings-auth";

export const runtime = "nodejs";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
}

export async function GET(request: NextRequest) {
  const credentials = settingsCredentials(process.env);
  if (!credentials) return reply({ detail: "설정 인증을 사용할 수 없습니다. 서버 설정을 확인해 주세요." }, 503);
  return reply({ authenticated: validSettingsSession(request.cookies.get(SETTINGS_SESSION_COOKIE)?.value, credentials, Date.now()) });
}

export async function POST(request: NextRequest) {
  if (!settingsRequestIsSameOrigin(request)) return reply({ detail: "설정 화면에서 다시 입력해 주세요." }, 403);
  const credentials = settingsCredentials(process.env);
  if (!credentials) return reply({ detail: "설정 인증을 사용할 수 없습니다. 서버 설정을 확인해 주세요." }, 503);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 1024) return reply({ detail: "입력이 너무 큽니다." }, 413);
    body = JSON.parse(text);
  } catch {
    return reply({ detail: "비밀번호를 다시 입력해 주세요." }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)
      || Object.keys(body).length !== 1 || !("password" in body) || typeof body.password !== "string") {
    return reply({ detail: "비밀번호를 다시 입력해 주세요." }, 400);
  }
  if (!settingsPasswordMatches(body.password, credentials)) {
    return reply({ detail: "비밀번호가 올바르지 않습니다. 다시 입력해 주세요." }, 401);
  }
  const response = reply({ authenticated: true });
  response.cookies.set(SETTINGS_SESSION_COOKIE, createSettingsSession(credentials, Date.now()), {
    httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:",
    path: "/", maxAge: SETTINGS_SESSION_SECONDS,
  });
  return response;
}
