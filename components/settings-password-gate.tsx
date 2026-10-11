"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

export function SettingsPasswordGate({ children }: { children: ReactNode }) {
  // 서버 세션이 남아 있어도 설정에 다시 들어올 때는 비밀번호를 확인한다.
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/settings-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }), cache: "no-store",
      });
      const body = await response.json();
      if (response.ok && body.authenticated === true) {
        setUnlocked(true);
      } else {
        setError(response.status === 401
          ? "비밀번호가 올바르지 않습니다. 다시 입력해 주세요."
          : "비밀번호 확인을 완료하지 못했습니다. 다시 시도해 주세요.");
      }
    } catch {
      setError("설정 인증 서버에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPassword("");
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  if (unlocked) return children;

  return (
    <main className="admin-workspace">
      <section aria-labelledby={`${inputId}-title`} className="mx-auto my-8 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:my-16 sm:p-8">
        <span className="mb-5 inline-flex rounded-xl bg-muted p-3 text-primary">
          <LockKeyhole size={24} aria-hidden />
        </span>
        <h1 id={`${inputId}-title`} className="text-2xl font-semibold tracking-tight">설정 비밀번호 확인</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">설정 화면에 들어가려면 비밀번호를 입력해 주세요.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor={inputId} className="text-sm font-medium">비밀번호</label>
            <input
              ref={inputRef}
              id={inputId}
              type="password"
              name="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
              readOnly={submitting}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className="settings-input block w-full rounded-lg border px-3 py-2 text-base"
            />
            {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex gap-3">
            <Link href="/" className="inline-flex flex-1 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">취소</Link>
            <button type="submit" disabled={!password || submitting} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "확인 중…" : "확인"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
