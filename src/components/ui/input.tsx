import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex h-8 w-full border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
