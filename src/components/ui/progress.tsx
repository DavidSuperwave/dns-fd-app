"use client"

import * as React from "react"

import { cn } from "../../lib/utils"

// Create a progress component that uses shadcn/ui styling without Radix dependency
const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <div
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        transitionProperty: "transform",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        transitionDuration: "150ms"
      }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }