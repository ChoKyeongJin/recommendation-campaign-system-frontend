import { NextRequest, NextResponse } from "next/server";
import {
  settingsApiRequiresSession, settingsCredentials, settingsRequestIsSameOrigin,
  validSettingsSession, SETTINGS_SESSION_COOKIE,
} from "@/lib/settings-auth";

export function proxy(request: NextRequest) {
  if (!settingsApiRequiresSession(request.nextUrl.pathname, request.method)) return NextResponse.next();
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  if (!settingsRequestIsSameOrigin(request)) {
    return NextResponse.json({ detail: "설정 화면에서 다시 시도해 주세요." }, { status: 403, headers });
  }
  const credentials = settingsCredentials(process.env);
  if (!credentials) {
    return NextResponse.json({ detail: "설정 인증을 사용할 수 없습니다. 서버 설정을 확인해 주세요." }, { status: 503, headers });
  }
  if (!validSettingsSession(request.cookies.get(SETTINGS_SESSION_COOKIE)?.value, credentials, Date.now())) {
    return NextResponse.json({ detail: "설정 비밀번호를 다시 확인해 주세요." }, { status: 401, headers });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/profile-setup/:path*", "/api/prompts/:path*", "/api/reference/:path*", "/api/request-limits/:path*"],
};
