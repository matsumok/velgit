import { useState } from "react";
import { useCreateRelease } from "../api/releases";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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
    <div className="p-4 border-t space-y-3">
      <p className="text-sm mb-3">図面セット作成</p>

      <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-4 items-center">
        <label
          htmlFor="release-name"
          className="block text-xs text-muted-foreground"
        >
          名称
        </label>
        <Input
          id="release-name"
          aria-label="図渡し名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="text-xs text-muted-foreground">種別</p>
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

        <label
          htmlFor="release-recipient"
          className="block text-xs text-muted-foreground"
        >
          相手先
        </label>
        <Input
          id="release-recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-6">
        {selectedFilenames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            対象図面: {selectedFilenames.length}枚
          </p>
        )}

        <Button
          disabled={isDisabled || isPending}
          onClick={handleSubmit}
          className="ml-auto"
        >
          {isPending ? "送信中..." : "図渡しを作成"}
        </Button>
      </div>
    </div>
  );
}
