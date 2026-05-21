import { cn } from "./lib/utils";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { useAppStore } from "./store/useAppStore";

function ProjectList() {
  const { selectedProject, setSelectedProject } = useAppStore();
  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-2">物件</p>
      <button
        type="button"
        className={cn(
          "w-full text-left px-3 py-2 rounded text-sm",
          selectedProject === "demo"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted",
        )}
        onClick={() => setSelectedProject("demo")}
      >
        デモ物件
      </button>
    </div>
  );
}

function DrawingList() {
  const { selectedProject } = useAppStore();
  if (!selectedProject) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        物件を選択してください
      </div>
    );
  }
  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground mb-2">図面一覧</p>
      <p className="text-sm text-muted-foreground">図面がありません</p>
    </div>
  );
}

function DrawingDetail() {
  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground">詳細</p>
    </div>
  );
}

function App() {
  return (
    <ThreePaneLayout
      left={<ProjectList />}
      center={<DrawingList />}
      right={<DrawingDetail />}
    />
  );
}

export default App;
