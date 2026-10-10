export type SqlRequestLimit = {
  daily_limit: number;
  used: number;
  remaining: number;
  date: string;
  timezone: string;
  resets_at: string;
  revision: number;
};

/** Keep admission failures visible before a progress stream is opened. */
export function requestLimitErrorResponse(upstream: Response, payload: unknown): Response | null {
  if (![429, 503].includes(upstream.status) || !payload || typeof payload !== "object" || !("detail" in payload)) return null;
  const detail = payload.detail;
  if (!detail || typeof detail !== "object" || !("stage" in detail) || detail.stage !== "request_admission" ||
      !("reason" in detail) || typeof detail.reason !== "string") return null;
  const headers = new Headers({ "Cache-Control": "no-store" });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return Response.json({ error: detail.reason, detail }, { status: upstream.status, headers });
}
