/**
 * Python API 를 부르는 서버 쪽 fetch.
 *
 * API 가 토큰 모드(`API_ACCESS_TOKEN`)로 돌면 모든 요청이 `Authorization: Bearer` 를 가져야 한다.
 * 토큰은 서버 환경 변수 `PYTHON_API_ACCESS_TOKEN` 에만 있다 — `NEXT_PUBLIC_` 이 아니라 번들에
 * 실리지 않고, 이 모듈은 라우트 핸들러만 쓴다. 비어 있으면 헤더를 싣지 않는다(그때 API 는 사설망
 * 요청만 받는 모드다). 호출자가 넘긴 Authorization 은 버린다 — 브라우저 값이 API 로 새지 않게.
 */

export const PYTHON_API_ACCESS_TOKEN_ENV = "PYTHON_API_ACCESS_TOKEN";

type ServerEnv = Readonly<Record<string, string | undefined>>;

export function pythonApiHeaders(init: HeadersInit | undefined, env: ServerEnv): Headers {
  const headers = new Headers(init);
  headers.delete("Authorization");
  const token = env[PYTHON_API_ACCESS_TOKEN_ENV];
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export function pythonFetch(
  input: string | URL,
  init: RequestInit = {},
  env: ServerEnv = process.env,
): Promise<Response> {
  return fetch(input, { ...init, headers: pythonApiHeaders(init.headers, env) });
}
