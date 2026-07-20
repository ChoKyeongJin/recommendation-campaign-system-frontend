# 현재 사용 중인 라이브러리

기준은 `package.json`, `app/**/*`, `components/**/*`, `lib/**/*`, `app/globals.css`, `postcss.config.mjs`, `components.json` 입니다.

## 런타임 / UI

| 라이브러리                 | 근거                                             | 사용 위치                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                     | App Router, 메타데이터, 폰트, 라우팅을 사용      | `app/layout.tsx`, `app/page.tsx`, `app/admin/prompts/page.tsx`, `app/admin/policies/page.tsx`, `app/admin/heuristic-ctr-rules/page.tsx`                                                                                                                                                                                          |
| `react` / `react-dom`      | 상태 훅과 컴포넌트 렌더링을 사용                 | `components/campaign-wizard.tsx`, `components/step-results.tsx`, `components/prompt-manager.tsx`, `components/policy-manager.tsx`, `components/heuristic-ctr-manager.tsx`, `components/step-*`, `components/ui/*`                                                                                                                |
| `@vercel/analytics`        | 운영 환경에서 Analytics를 조건부 렌더링          | `app/layout.tsx`                                                                                                                                                                                                                                                                                                                 |
| `lucide-react`             | 아이콘 컴포넌트를 화면 전반에서 사용             | `components/campaign-wizard.tsx`, `components/step-results.tsx`, `components/settings-menu.tsx`, `components/step-targeting.tsx`, `components/step-messages.tsx`, `components/step-prompt.tsx`, `components/prompt-manager.tsx`, `components/policy-manager.tsx`, `components/heuristic-ctr-manager.tsx`, `app/admin/*/page.tsx` |
| `recharts`                 | 클릭률 차트와 차트 래퍼에 사용                   | `components/step-results.tsx`, `components/ui/chart.tsx`                                                                                                                                                                                                                                                                         |
| `@base-ui/react`           | 버튼, 탭, 렌더 헬퍼를 감싼 UI 프리미티브에 사용  | `components/ui/button.tsx`, `components/ui/tabs.tsx`, `components/ui/badge.tsx`                                                                                                                                                                                                                                                  |
| `class-variance-authority` | 버튼/배지의 variant 클래스 생성                  | `components/ui/button.tsx`, `components/ui/badge.tsx`                                                                                                                                                                                                                                                                            |
| `clsx`                     | 조건부 클래스 결합용 `cn` 헬퍼에 사용            | `lib/utils.ts`                                                                                                                                                                                                                                                                                                                   |
| `tailwind-merge`           | 중복 Tailwind 클래스를 정리하는 `cn` 헬퍼에 사용 | `lib/utils.ts`                                                                                                                                                                                                                                                                                                                   |

## 스타일 / 빌드

| 라이브러리             | 근거                                         | 사용 위치                            |
| ---------------------- | -------------------------------------------- | ------------------------------------ |
| `tailwindcss`          | 전역 스타일에서 Tailwind를 직접 import       | `app/globals.css`                    |
| `@tailwindcss/postcss` | PostCSS 플러그인으로 연결                    | `postcss.config.mjs`                 |
| `tw-animate-css`       | 전역 애니메이션 유틸리티 import              | `app/globals.css`                    |
| `shadcn`               | shadcn Tailwind 스타일을 전역 CSS에서 import | `app/globals.css`, `components.json` |

## 참고

- `@types/*`와 `typescript`는 런타임 라이브러리라기보다 타입체크/빌드용 도구입니다.
- 위 목록은 코드에서 실제 import 또는 설정으로 확인된 항목만 적었습니다.
