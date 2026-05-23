import type { ReactNode } from "react";

interface ThreePaneLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreePaneLayout({ left, center, right }: ThreePaneLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="w-72 shrink-0 border-r">{left}</aside>
      <main className="flex-1 overflow-auto">{center}</main>
      <aside className="w-80 shrink-0 border-l">{right}</aside>
    </div>
  );
}
