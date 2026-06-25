# isDiffMode はグローバルストアで管理し図面切り替えをまたいで維持する

## Context

`isDiffMode`（差分表示トグル）は `CommitHistoryPanel` 内のみで読み書きされる。1コンポーネント専用の状態をグローバルストアに置くのは過剰に見える。

`DrawingDetail` は `key={selectedDrawing}` を持つため、図面を切り替えるたびに `CommitHistoryPanel` が完全に再マウントされる。ローカル `useState` に移すと図面切り替えのたびに `isDiffMode` が `false` にリセットされる。

## Decision

`isDiffMode` / `setIsDiffMode` は `useAppStore` に残す。

## Consequences

- 図面を切り替えても差分表示モードの ON/OFF が維持される
- `isDiffMode` は `partialize` 対象外のため、アプリ再起動時は `false` にリセットされる
- 「1コンポーネントしか使っていないのにグローバルストアにある」という外見上の不自然さは、この ADR で意図的な設計であると明示する
