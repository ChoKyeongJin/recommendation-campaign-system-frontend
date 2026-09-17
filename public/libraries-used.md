# 현재 사용 중인 라이브러리

기준은 `package.json`, `app/**/*`, `components/**/*`, `lib/**/*`와 스타일·빌드 설정이다.

| 라이브러리 | 역할 | 주요 사용 위치 |
| --- | --- | --- |
| `next` | App Router, 메타데이터, API route | `app/` |
| `react`, `react-dom` | 타겟팅 화면 상태와 렌더링 | `components/` |
| `@vercel/analytics` | 운영 방문 분석 | `app/layout.tsx` |
| `lucide-react` | 화면 아이콘 | `components/` |
| `@base-ui/react` | UI 프리미티브 | `components/ui/` |
| `class-variance-authority` | 버튼·배지 variant | `components/ui/` |
| `clsx`, `tailwind-merge` | 조건부 class 결합 | `lib/utils.ts` |
| `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css` | 스타일과 빌드 | `app/globals.css`, `postcss.config.mjs` |

`@types/*`와 `typescript`는 타입 검사와 빌드에 사용한다.
