import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["조건 입력", "타겟 결과"]

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="진행 단계" className="target-stepper">
      <ol className="grid grid-cols-2 gap-2">
        {STEPS.map((label, i) => {
          const status = i < current ? "done" : i === current ? "active" : "todo"
          return (
            <li
              key={label}
              aria-current={status === "active" ? "step" : undefined}
              className={cn(
                "border-t-2 pt-3 transition-colors",
                status === "done" && "border-foreground",
                status === "active" && "border-brand",
                status === "todo" && "border-border",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.12em]",
                  status === "active" ? "text-brand" : status === "done" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {`0${i + 1}`}
                {status === "done" && (
                  <>
                    <Check className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                    <span className="sr-only">완료</span>
                  </>
                )}
              </span>
              <span
                className={cn(
                  "mt-1 block whitespace-nowrap text-[15px]",
                  status === "active" ? "font-semibold text-foreground" : status === "done" ? "font-medium text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
