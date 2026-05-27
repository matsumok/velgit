# PDF diff パフォーマンス最適化

## 決定

`generate_diff` パイプラインを以下の構成で実装する。

- **PNG encode（overlay）**: `png_encode_fast` モジュール — Sub フィルタ固定 + `flate2`（miniz_oxide バックエンド）+ rayon 行並列
- **PNG decode（キャッシュ読み出し）**: `image::load_from_memory`（`png` クレート + fdeflate バックエンド）
- **pixel diff**: rayon `par_chunks` による single-pass
- **キャッシュフォーマット**: `png_data`（PNG）のみ — rgba_zstd は導入しない

## 背景

コミット済み PDF 同士の diff 表示に **約 19.2 秒**かかっていた。制約として diff 画像の都度生成（ADR-0020）と DPI 設定（350 DPI / 5787px）は変更しない。

パイプラインの計測内訳（改善前、dev ビルド）:

| ステージ | 時間 |
|---|---|
| stage2/3 PNG decode × 2 | 3.5s |
| stage4 diff + overlay 構築 | 2.4s |
| stage5 overlay PNG encode | **13.2s** |
| 合計 | ~19.2s |

## 検証と最適化の経緯

### Stage5 の根本原因

`image::PngEncoder` のデフォルト `FilterType::Adaptive` が全行に対して5種類のフィルタを試してから最良を選ぶ設計で、dev/release 関係なく遅い。`FilterType::Sub` 固定に変えるだけで 13.2s → 2.7s になった。

### 追加の改善

| 変更 | 効果 |
|---|---|
| Sub フィルタ + `CompressionType::Fast` + spawn_blocking | stage5: 13.2s → 2.7s |
| PNG decode を `tokio::join!` で A/B 並列 | decode: 3.5s → 1.8s |
| diff+overlay を rayon `par_chunks` 並列化 | overlay: 2.1s → 0.6s |
| 2-pass → `AtomicBool` 1-pass | -0.3s |
| `flate2` + zlib-ng カスタムエンコーダ | stage5: 2.7s → 1.3s（dev）|
| Sub フィルタ適用を rayon 並列化 | stage5: 1.3s → 0.06s（release）|

### rgba_zstd の検討と棄却

dev ビルドで PNG decode が 1.7s/枚かかっていたため、zstd 圧縮した生 RGBA バイト列（rgba_zstd）をキャッシュに追加して高速化した。しかし **release ビルドで計測し直したところ、PNG decode は 0.057s/枚**（`png` クレートが fdeflate SIMD バックエンドを使用）であり、rgba_zstd（0.06〜0.11s）と同等以上の速度だった。

dev ビルドでの遅さは SIMD 最適化が無効なためであり、PNG decode 自体は release ビルドで十分速い。rgba_zstd は不要な複雑性だったため削除した。

### zlib-ng の検討と棄却

`flate2` に zlib-ng（C ネイティブ）バックエンドを使っていたが、miniz_oxide（純 Rust）と release ビルドで計測比較したところ stage5 が 0.064s → 0.067s と誤差範囲だった。C 依存を排除するため `flate2 = "1"`（miniz_oxide デフォルト）に戻した。

## 最終計測結果（release ビルド、cache HIT）

| ステージ | 時間 |
|---|---|
| stage1 git blob | 0.022s |
| stage2 PNG decode | 0.057s |
| stage3 PNG decode | 0.056s |
| stage4 diff+overlay（rayon） | 0.069s |
| stage5 overlay PNG encode | 0.067s |
| stage6 base64 | 0.002s |
| **合計** | **0.327s** |

**改善率: 19.2s → 0.327s（98.3% 削減）**

## Considered Options

### rgba_zstd を保持する（棄却）

キャッシュに `rgba_zstd` カラムと `png_data` カラムを併存させる。`generate_diff` は rgba_zstd、`get_pdf_image` は png_data を使う。dev ビルドの計測値を根拠に導入したが、release ビルドでは PNG decode が同等の速度であり、DB 冗長・コード複雑化のデメリットが上回るため棄却。

### zlib-ng バックエンドを維持する（棄却）

release ビルドで miniz_oxide と速度差がなく、C ライブラリ依存を持ち込む理由がないため棄却。

### `FilterType::Adaptive` を維持する（棄却）

圧縮率が若干向上するが、処理時間が 13 秒超になるため論外。
