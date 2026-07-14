import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["프롬프트 입력", "타겟팅 결과", "메시지 추천", "클릭률 분석"]

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="진행 단계" className="w-full">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const status = i < current ? "done" : i === current ? "active" : "todo"
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                    status === "done" && "border-primary bg-primary text-primary-foreground",
                    status === "active" && "border-primary bg-background text-primary",
                    status === "todo" && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {status === "done" ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-medium sm:block",
                    status === "todo" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "mx-3 h-px flex-1 transition-colors",
                    i < current ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
