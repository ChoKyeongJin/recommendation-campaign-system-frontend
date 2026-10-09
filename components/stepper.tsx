import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["조건 입력", "타겟 결과"]

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="진행 단계" className="target-stepper">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const status = i < current ? "done" : i === current ? "active" : "todo"
          return (
            <li key={label} aria-current={status === "active" ? "step" : undefined} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    status === "done" && "bg-primary text-primary-foreground",
                    status === "active" && "bg-[#e4fab5] text-foreground",
                    status === "todo" && "bg-[#e9ecf0] text-muted-foreground",
                  )}
                >
                  {status === "done" ? <Check className="h-4 w-4" aria-hidden /> : `0${i + 1}`}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-sm font-medium",
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
