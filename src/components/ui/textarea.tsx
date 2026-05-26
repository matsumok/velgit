import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
