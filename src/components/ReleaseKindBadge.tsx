import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export function ReleaseKindBadge({ kind }: { kind: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs",
        kind === "external"
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      )}
    >
      {kind === "external" ? "社外" : "社内"}
    </Badge>
  );
}
