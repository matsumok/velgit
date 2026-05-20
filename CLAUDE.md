# Velgit - CLAUDE.md

## プロジェクト概要

建築の図面PDF管理に特化したデスクトップアプリケーション。
Git GUIに、PDFの視覚的diff表示を統合する。

### ターゲット
- 建築設計事務所向けのツール
- Windowsユーザー（ブラウザ・GUIのみ、CLIは不要）
- RevitおよびAutoCADから出力されたPDFを対象

### 非目標
- クラウドサービス・外部サーバーは使わない
- 常時起動プロセスは不要
- LFSは使わない（.gitの肥大化は10GBまで許容）

---

## 技術スタック

| 役割 | 採用技術 |
|------|---------|
| アプリ基盤 | Tauri v2 |
| フロントエンド | React + TypeScript |
| UIコンポーネント | shadcn（Base / Lyra プリセット） |
| アイコン | @phosphor-icons/react |
| Git操作 | git2-rs |
| PDF描画・画像化 | pdfium-render（プレビュー・diff両用） |
| 差分検出 | pixelmatch（JS側） |
| ツリー描画 | react-gitgraph |
| スタイリング | Tailwind CSS v4 |
| パッケージマネージャ | pnpm（corepack） |

---

## アーキテクチャ方針

### 全体構成

```
Tauri
├── フロントエンド（React + TypeScript + shadcn）
│   ├── コミットツリー（react-gitgraph）
│   ├── PDFビューア（pdfium-render経由のPNG表示）
│   └── diffビューア（pixelmatch）
└── バックエンド（Rust）
    ├── git2-rs（Git操作）
    └── pdfium-render（PDF→PNG変換。プレビュー・diff共用）
```

### PDF操作の役割分担

```
pdfium-render（Rustバックエンド）
  → プレビュー用PNG生成（低解像度）
  → diff用PNG生成（高解像度）
  ※ エンジンを統一することで依存を削減し、レンダリング結果の一貫性を確保

lopdf（将来）
  → メタデータ抽出・タイトルブロックパース
```

### diff処理フロー

```
ユーザーがcommit AとBを選択
  ↓
git2-rsで両commitからblobを直接取得（ファイルシステム経由しない）
  ↓
pdfium-renderでページ単位に画像化
  ↓
pixelmatchで差分検出
  ↓
差分ハイライト画像をフロントに返す
```

### diff エンジンの抽象化

将来の精度改善に備えてtraitで抽象化する。

```rust
// src-tauri/src/diff/mod.rs
pub trait PdfDiffer: Send + Sync {
    fn diff(&self, old_pixels: &[u8], new_pixels: &[u8], width: u32, height: u32)
        -> Result<DiffResult, DiffError>;
    fn name(&self) -> &'static str;
}

// Phase 1: ピクセル比較
struct PixelmatchDiffer;

// Phase 2: ベクター構造比較（将来）
struct VectorDiffer;

// Phase 3: AI差分検出
struct AiDiffer; // Pixelmatch + AI の3段階パイプライン
```

### 3段階差分検知パイプライン（Phase 3）

```
Stage 1: Pixelmatch（全ページ・高速）
  閾値A: pixel_threshold   … ピクセル色差の許容値（0-255）
  閾値B: min_changed_ratio … 変化ピクセル率の下限（%）
  → 変化マスク生成。閾値以下は「変化なし」で確定・終了

        ↓ 変化ありタイルのみ（512×512）

Stage 2: MobileNetV3ゲート（ノイズ除去）
  閾値C: gate_confidence … 確信度の下限
  → アンチエイリアス・レンダリング差を除去

        ↓ 通過したタイルのみ

Stage 3: DINOv2（構造差分・精密）
  閾値D: feature_threshold … コサイン類似度の下限
  → 変化領域の確信度スコアを算出
```

**ヒートマップ表示（3色）**:
- 黄: Stage 1のみ通過（微細変化）
- オレンジ: Stage 2まで通過（中程度）
- 赤: Stage 3まで通過（構造的変化）

**出力データ構造**:
```rust
pub struct DiffResult {
    pub changed_regions: Vec<ChangedRegion>,
    pub change_score: f32,        // 0.0=同一, 1.0=完全に異なる
    pub heatmap: Option<Vec<u8>>, // PNG bytes（3色オーバーレイ）
    pub stage_stats: StageStats,  // 各ステージの通過タイル数
}
pub struct ChangedRegion {
    pub x: u32, pub y: u32, pub width: u32, pub height: u32,
    pub stage: DiffStage,  // Pixel / Gate / Feature
    pub confidence: f32,
}
```

**閾値設定（ユーザー設定可能）**:
```rust
pub struct DiffConfig {
    pub pixel_threshold: u8,       // デフォルト: 10
    pub min_changed_ratio: f32,    // デフォルト: 0.01（1%）
    pub gate_confidence: f32,      // デフォルト: 0.5
    pub feature_threshold: f32,    // デフォルト: 0.15（コサイン距離）
    pub tile_size: u32,            // デフォルト: 512
}
```

### AiDiffer 技術選定（確定）

| コンポーネント | 採用 | ライセンス | 配布方法 |
|--------------|------|-----------|---------|
| 推論ランタイム | `ort` crate v2.x（ONNX Runtime） | MIT | `onnxruntime.dll` をMSIに同梱 |
| フィーチャーモデル | DINOv2 ViT-S/14 ONNX（~85MB） | Apache 2.0 | MSIに同梱 |
| ゲートモデル | MobileNetV3-Small ONNX（~9MB） | Apache 2.0 | MSIに同梱 |
| GPU対応 | DirectML（fallback: CPU） | MIT | `onnxruntime_providers_directml.dll` を同梱 |

**MSI総サイズ見込み**: ~127MB（モデル・DLL込み）  
**ライセンス義務**: Apache 2.0 / MIT の NOTICEファイルを配布物に同梱する  
**注意**: DINOv2はImageNet学習済み（CADはドメイン外）。類似度は絶対値でなく相対値として使い、感度は設定で調整可能にする。

### PDF解像度方針（基本サイズ: A3）

基本図面サイズはA3（297×420mm）。A1対応も視野に入れた設計とする。

| サイズ | 72dpi（プレビュー） | 300dpi（diff） |
|--------|-------------------|---------------|
| A3 | ~840×1190px | ~3508×4961px |
| A1 | ~2384×1684px | ~9933×7016px |

```
Pass 1（72dpi）: 全体スクリーニング → 変化あり領域を特定
Pass 2（300dpi）: 変化あり領域のみ高解像度で再処理
```
タイルサイズ: 512×512、stride 448（64pxオーバーラップ）  
A3 300dpiのピーク使用メモリ: ~52MB

---

## ファイル・図面管理方針

### ネーミングは人間が管理する

- `drawings.db` などのメタデータDBは持たない
- ファイル名 = 図面番号で統一するルールを運用で徹底する
- 図面名称はcommitメッセージで管理する

```
ファイル名例:
  A-101.pdf
  A-102.pdf
  S-201.pdf

commitメッセージ例:
  "A-101: 1F平面図 Rev.2 開口部変更"
```

- ファイル名変更が必要な場合はVelgitのGUIからgit mvを実行する

### リポジトリ構成

```
共有フォルダ（NASまたは常時起動PC）
└── ProjectA\
    ├── .git\        ← Gitの全データ
    ├── A-101.pdf
    ├── A-102.pdf
    └── S-201.pdf
```

---

## UI設計方針

### 3ペイン構成

```
左ペイン  : 図面ファイルリスト
中央      : コミットツリー（react-gitgraph）
右ペイン  : PDFプレビュー + diff
```

### Git操作のGUI対応

| Git操作 | VelgitのUI表現 |
|---------|---------------|
| git init | プロジェクト作成 |
| git add + commit | 図面を登録・更新 |
| git log --graph | コミットツリー表示 |
| blob取得 + diff | PDF差分表示 |
| git branch | 設計案の分岐 |
| git merge | 設計案の統合 |
| git mv | ファイル名変更 |

### Tailwind クラス記述規約

- **サイズ指定は Tailwind / shadcn のユーティリティクラスで統一する**
  - `text-sm`, `text-xs`, `text-2xs`（カスタム: 0.625rem）など
  - `px-[14px]` のような arbitrary value（`[]` ブラケット構文）は使わない
- **数値は整数のみ**
  - padding / margin / width / height / gap はすべて整数スケール（`p-2`, `gap-1`, `w-3` など）
  - `py-1.5`, `gap-0.5`, `w-2.5` のような小数値は使わない
- **shadcn の `src/components/ui/` 配下はこの規約の対象外**（生成コードのため変更しない）

### shadcn コンポーネントの取り扱い

- `src/components/ui/` 配下のファイルは **shadcn が生成したコンポーネント**であり、原則として手を加えない
- バグ修正・スタイル変更・リファクタリングの対象にしない
- アップデートが必要な場合は shadcn CLI で再生成する
- **biome のフォーマット・lint・import sort の対象外**（`biome.json` の `files.ignore` で除外済み）

---

## 技術的課題

### 高優先（設計初期に解決必要）

- **pdfium.dllの配布戦略**
  - Windowsでは`pdfium.dll`（約3MB）をアプリに同梱する必要あり
  - Tauriのバンドル設定で対応

- **UNCパスのgit2-rs対応**
  - 共有フォルダ（`\\server\drawings\ProjectA`）をgit2-rsで開けるか検証が必要

### 中優先（実装中に直面）

- **差分画像のフロント受け渡し設計**
  - base64渡し vs 一時ファイルパス渡しの判断（現状: ipc::Response でバイナリ直渡し）

### 後回し

- PDF diff の精度改善（アンチエイリアス誤検知対策・閾値調整）
- ツリー描画のパフォーマンス（ブランチ多数時）
- RevitおよびAutoCAD製PDFの再書き出し時の同一性検証
- ベクター構造比較によるdiff（VectorDiffer実装）
- lopdfによるタイトルブロックのメタデータ抽出

---

## バックエンド API 一覧（フロント連携用）

### Git 操作

| コマンド | 引数 | 戻り値 | 説明 |
|---------|-----|--------|------|
| `open_repo` | `path: string` | `RepoInfo` | リポジトリを開く |
| `get_commits` | `path, max_count` | `CommitInfo[]` | コミット履歴取得 |
| `get_changed_files` | `repo_path, commit_sha` | `string[]` | コミットの変更ファイル一覧 |
| `get_working_tree_status` | `repo_path` | `WorkingFileEntry[]` | ワーキングツリー状態 |
| `stage_file` | `repo_path, relative_path` | `void` | ファイルをステージ |
| `create_commit` | `repo_path, message` | `string` | コミット作成（short SHA返す） |
| `list_branches` | `repo_path` | `BranchInfo[]` | ローカルブランチ一覧 |
| `create_branch` | `repo_path, branch_name, from_sha?` | `void` | ブランチ作成 |
| `checkout_branch` | `repo_path, branch_name` | `void` | ブランチ切り替え |
| `delete_branch` | `repo_path, branch_name` | `void` | ブランチ削除 |
| `merge_branch` | `repo_path, branch_name, message?` | `string` | マージ（FF/merge-commit/already-up-to-date） |
| `rename_file` | `repo_path, old_relative_path, new_relative_path` | `void` | git mv |

### PDF 操作

| コマンド | 引数 | 戻り値 | 説明 |
|---------|-----|--------|------|
| `get_pdf_page_count` | `path` | `number` | ページ数（ファイルシステム） |
| `get_pdf_page_count_at_commit` | `repo_path, commit_sha, file_path` | `number` | コミット時点のページ数 |
| `render_pdf_page` | `path, page, scale` | `ArrayBuffer` | PNG バイナリ（ファイルシステム） |
| `render_pdf_page_at_commit` | `repo_path, commit_sha, file_path, page, scale` | `ArrayBuffer` | PNG バイナリ（コミット時点） |
| `diff_pdf_pages_at_commits` | `repo_path, commit_a, commit_b, file_path, page, scale` | `PageDiffResult` | diff オーバーレイ PNG（base64） |

### 主要型定義

```typescript
interface BranchInfo {
  name: string;
  is_head: boolean;
  upstream: string | null;
  tip_sha: string;
  tip_message: string;
}

interface RepoInfo {
  name: string;
  path: string;
  branch: string;
  head_sha: string;
  head_message: string;
}
```

---

## 開発ロードマップ

### Phase 1（MVP）
- ~~Tauriプロジェクトのskeleton作成~~ ✅ 完了（2026-05-20）
- ~~git2-rsによるリポジトリ操作（init / add / commit / log）~~ ✅ 完了
- ~~react-gitgraphによるコミットツリー表示~~ ✅ 完了
- ~~pdfium-renderによるPDFプレビュー表示（PDF.jsから移行）~~ ✅ 完了（2026-05-20）
- ~~pdfium-renderによるdiff用PDF画像化~~ ✅ 完了（2026-05-20）
- ~~git操作（stage / commit）~~ ✅ 完了（2026-05-21）
- ~~diff表示（ピクセル比較・赤ハイライト・変化率）~~ ✅ 完了（2026-05-21）

### Phase 2
- UNCパス対応の検証・修正（libgit2はUNCパスをネイティブサポート、要実機テスト）
- 大判PDFのメモリ最適化
- ~~ブランチ操作バックエンド（list/create/checkout/delete/merge）~~ ✅ 完了（2026-05-21）
- ~~git mv バックエンド（rename_file コマンド）~~ ✅ 完了（2026-05-21）
- ブランチ操作のUI（BranchList パネル、チェックアウト・作成・削除ダイアログ）
- git mv のUI（FileExplorer からリネームダイアログ）

### Phase 3
- PDF diff精度改善
- ベクター構造比較の検討
- RevitおよびAutoCAD製PDF固有の対応

---

## 開発環境

### 基本環境

| 項目 | 採用 |
|------|------|
| OS | Windows 11 |
| エディタ | Zed |
| Rustツールチェーン | stable（x86_64-pc-windows-msvc） |
| Node.jsバージョン管理 | fnm（Windows向け nvm相当） |
| パッケージマネージャ | pnpm（corepack経由） |
| ビルド | Windowsネイティブビルド |
| CI/CD | ローカルビルドのみ（当面） |
| ライセンス | GPL-3.0-or-later |

### コード品質（biome）

- **リンター・フォーマッター**: [biome](https://biomejs.dev/)（`biome.json` で設定済み）
- **コミット前に必ず実行**: `pnpm biome check src/`
  - エラー・警告がゼロであることを確認してからコミットする
- **保存時自動修正**: `.zed/settings.json` で設定済み（Zed のプロジェクト設定）
  - biome 拡張を有効化すれば保存時に自動フォーマット・import sort が適用される
- **除外対象**: `src/components/ui/**`（shadcn 生成コード）は `biome.json` の `overrides` で除外済み

### 前提ツール

```powershell
# 1. Visual Studio Build Tools（MSVCリンカに必要）
#    https://visualstudio.microsoft.com/visual-cpp-build-tools/
#    「C++によるデスクトップ開発」ワークロードを選択

# 2. Rustup
winget install Rustlang.Rustup

# 3. fnm（Node.jsバージョン管理）
winget install Schniz.fnm
fnm install --lts
fnm use --lts

# 5. pnpm（corepack経由）
corepack enable pnpm

# 6. Tauri CLI は pnpm 経由で利用（@tauri-apps/cli をdevDepsに追加済み）
#    pnpm tauri dev / pnpm tauri build で実行

# 7. WebView2ランタイム（Windows 11は標準搭載）
#    https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

### pdfium.dllの準備

```powershell
# pdfium-binariesからWindows向けビルド済みバイナリを取得
# https://github.com/bblanchon/pdfium-binaries
# pdfium-win-x64.tgz を展開して pdfium.dll をプロジェクトに同梱
```

pdfium-renderは実行時にpdfium.dllをバインドする設計。
ビルド時に`PDFIUM_DYNAMIC_LIB_PATH`でdllのパスを指定する。

```powershell
$env:PDFIUM_DYNAMIC_LIB_PATH = ".\libs\pdfium"
cargo tauri build
```

---

## 配布方針

- Tauriの`.msi`インストーラで配布
- `pdfium.dll`を同梱
- Git for Windowsは別途インストール不要（git2-rsはlibgit2を静的リンク）
