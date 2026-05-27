# useMemo の依存配列には安定した参照を渡す

## 決定

`useMemo` の依存配列には、毎レンダーで同一参照が保証される値のみを渡す。
具体的には以下の2つのルールを守る。

1. **フックが返すオブジェクトをそのまま dep に入れない** — プリミティブ値（文字列・数値・真偽値）のフィールドを取り出して渡す
2. **React Query の無効クエリのデフォルト値にインライン `[]` を使わない** — モジュールレベルの定数を使う

## 理由

### 背景：チェックボックスがリセットされ続けるバグ

`DrawingTable` は `rows` prop が変わったときにチェックボックスの選択状態をリセットする `useEffect` を持つ。

```ts
useEffect(() => {
  setRowSelection(Object.fromEntries(rows.map((r) => [r.filename, true])));
}, [rows]);
```

これはコミット・図渡し後に選択を初期化する正当な処理だが、`rows` の参照が毎レンダーで変わると「常に全選択に戻る」バグが発生する。

### 原因1：フック戻り値のオブジェクトを dep に渡す

```ts
// useAppMode() は毎レンダーで新しいオブジェクトを返す
const appMode = useAppMode();

// Bad: オブジェクト参照が変わるたびに rows が再計算される
const rows = useMemo(() => { ... }, [appMode, ...]);

// Good: 文字列プリミティブは値比較なので安定
const rows = useMemo(() => { ... }, [appMode.mode, ...]);
```

### 原因2：無効クエリのデフォルト値にインライン `[]`

`useGetReleaseDrawings(null)` は `enabled: false` のため `data` が常に `undefined`。

```ts
// Bad: releaseId が null のとき、デストラクチャリングのたびに新しい [] が生成される
const { data: releaseDrawings = [] } = useGetReleaseDrawings(releaseId);

// Good: モジュールレベル定数は全レンダー共通の参照を持つ
const EMPTY_FILENAMES: string[] = [];
const { data: releaseDrawings = EMPTY_FILENAMES } = useGetReleaseDrawings(releaseId);
```

### 関連：Base UI Checkbox は onCheckedChange を使う

Base UI の Checkbox は内部で hidden `<input>` への合成 PointerEvent を dispatch する。
`onClick` で直接 toggle を実装すると、この PointerEvent が span まで bubble back して二重 toggle になる。

```tsx
// Bad: onClick で直接 toggle すると二重発火
<Checkbox
  checked={row.getIsSelected()}
  onClick={(e) => { e.stopPropagation(); row.toggleSelected(!row.getIsSelected()); }}
/>

// Good: onCheckedChange は Base UI 側で重複排除済み
<Checkbox
  checked={row.getIsSelected()}
  onCheckedChange={(v) => row.toggleSelected(!!v)}
  onClick={(e) => e.stopPropagation()}  // 行クリックへの伝播だけ止める
/>
```

## Considered Options

- **`useAppMode` をメモ化して安定した参照を返す** — フック内部で `useMemo` を使えば呼び出し側の修正が不要になる。ただし `useAppMode` は複数の reactive 値を合成しており、メモ化条件を正確に書く必要がある。フック呼び出し側で `.mode` を取り出す方が局所的で安全。
- **`DrawingTable` の reset effect を削除する** — 選択リセットのロジックを別の信号（コミット完了イベントなど）で駆動する設計も考えられる。ただし変更範囲が広いため今回は見送り。
