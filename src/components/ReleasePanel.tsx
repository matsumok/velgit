import { useState } from "react";
import { useCreateRelease } from "../api/releases";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";

export function ReleasePanel({
  selectedFilenames,
}: {
  selectedFilenames: string[];
}) {
  const { mutateAsync, isPending } = useCreateRelease();
  const username = useAppStore((s) => s.username);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"internal" | "external">("internal");
  const [recipient, setRecipient] = useState("");

  const isDisabled = !name.trim() || selectedFilenames.length === 0;

  async function handleSubmit() {
    await mutateAsync({
      name: name.trim(),
      kind,
      recipient: recipient.trim() || null,
      drawingFilenames: selectedFilenames,
      createdBy: username ?? "",
    });
    setName("");
    setKind("internal");
    setRecipient("");
  }

  return (
    <div className="p-4 border-t">
      <p className="text-xs text-muted-foreground mb-3">図渡し作成</p>

      <div className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="release-name"
            className="block text-xs text-muted-foreground mb-1"
          >
            図渡し名称
          </label>
          <input
            id="release-name"
            type="text"
            aria-label="図渡し名称"
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">種別</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="release-kind"
                value="internal"
                checked={kind === "internal"}
                onChange={() => setKind("internal")}
              />
              社内図渡し
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="release-kind"
                value="external"
                checked={kind === "external"}
                onChange={() => setKind("external")}
              />
              社外図渡し
            </label>
          </div>
        </div>

        <div>
          <label
            htmlFor="release-recipient"
            className="block text-xs text-muted-foreground mb-1"
          >
            相手先
          </label>
          <input
            id="release-recipient"
            type="text"
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>

        {selectedFilenames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            対象図面: {selectedFilenames.length}枚
          </p>
        )}

        <button
          type="button"
          disabled={isDisabled || isPending}
          onClick={handleSubmit}
          className={cn(
            "px-3 py-2 rounded text-sm bg-primary text-primary-foreground",
            (isDisabled || isPending) && "opacity-50 cursor-not-allowed",
          )}
        >
          {isPending ? "送信中..." : "図渡しを作成"}
        </button>
      </div>
    </div>
  );
}
