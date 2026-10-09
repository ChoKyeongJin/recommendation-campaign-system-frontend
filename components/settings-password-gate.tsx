"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

const SETTINGS_PASSWORD = "4567";

// 화면 진입 확인용 잠금입니다. 서버 API의 인증을 대신하지 않습니다.
export function SettingsPasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== SETTINGS_PASSWORD) {
      setError("비밀번호가 올바르지 않습니다. 다시 입력해 주세요.");
      setPassword("");
      inputRef.current?.focus();
      return;
    }
    setPassword("");
    setError("");
    setUnlocked(true);
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
            <button type="submit" disabled={!password} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50">확인</button>
          </div>
        </form>
      </section>
    </main>
  );
}
