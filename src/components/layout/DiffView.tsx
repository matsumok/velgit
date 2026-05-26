import { ImageDialog } from "./ImageDialog";

interface DiffViewProps {
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export function DiffView({ imageUrl, isLoading, error }: DiffViewProps) {
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-muted-foreground">画像を生成中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center px-4">
        <p className="text-sm text-destructive text-center">{error}</p>
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <div className="w-full border-t border-border">
      <ImageDialog src={imageUrl} alt="差分プレビュー" />
    </div>
  );
}
