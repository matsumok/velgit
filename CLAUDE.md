# Velgit - CLAUDE.md

## プロジェクト概要

建築図面PDF管理に特化したデスクトップアプリケーション。
SourcetreeライクなGit GUIに、PDFの視覚的diff表示を統合する。

### ターゲット
- 建築事務所の社内ツール
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
| PDF画像化 | pdfium-render ※nightly互換性問題あり、現在除外中 |
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
│   ├── PDFビューア（PDF.js）
│   └── diffビューア（pixelmatch）
└── バックエンド（Rust）
    ├── git2-rs（Git操作）
    └── pdfium-render（PDF→画像変換）
```

### PDF操作の役割分担

```
PDF.js（フロントエンド）
  → プレビュー表示

pdfium-render（Rustバックエンド）
  → diff用の画像生成（大判・高解像度を高速処理）

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
trait PdfDiffer {
    fn diff(old: &[u8], new: &[u8]) -> DiffResult;
}

// Phase 1
struct PixelmatchDiffer;

// Phase 2
struct VectorDiffer;

// Phase 3
struct AiDiffer;
```

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

---

## 技術的課題

### 高優先（設計初期に解決必要）

- **pdfium-renderのnightly互換性**
  - 最新nightly（2026-05-20時点）でビルドエラー（1513 errors）のためCargo.tomlから除外中
  - PDF機能実装前に動作するnightlyバージョンを検証して固定する
  - `rust-toolchain.toml`で日付指定（例: `channel = "nightly-2025-xx-xx"`）で対応予定

- **pdfium.dllの配布戦略**
  - Windowsでは`pdfium.dll`（約3MB）をアプリに同梱する必要あり
  - Tauriのバンドル設定で対応

- **UNCパスのgit2-rs対応**
  - 共有フォルダ（`\\server\drawings\ProjectA`）をgit2-rsで開けるか検証が必要

### 中優先（実装中に直面）

- **大判PDFのメモリ管理**
  - 300dpiでA1 = 約10,000×7,000px
  - 段階的解像度処理（低解像で差分領域を検出 → 該当箇所のみ高解像）を検討

- **差分画像のフロント受け渡し設計**
  - base64渡し vs 一時ファイルパス渡しの判断

### 後回し

- PDF diff の精度改善（アンチエイリアス誤検知対策・閾値調整）
- ツリー描画のパフォーマンス（ブランチ多数時）
- RevitおよびAutoCAD製PDFの再書き出し時の同一性検証
- ベクター構造比較によるdiff（VectorDiffer実装）
- lopdfによるタイトルブロックのメタデータ抽出

---

## 開発ロードマップ

### Phase 1（MVP）
- ~~Tauriプロジェクトのskeleton作成~~ ✅ 完了（2026-05-20）
- git2-rsによるリポジトリ操作（init / add / commit / log）
- react-gitgraphによるコミットツリー表示
- PDF.jsによるPDFプレビュー
- pdfium-renderによるPDF画像化
- pixelmatchによる基本的なdiff表示

### Phase 2
- UNCパス対応の検証・修正
- 大判PDFのメモリ最適化
- ブランチ・マージのGUI対応
- git mvのGUI対応

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
| Rustツールチェーン | nightly（x86_64-pc-windows-msvc） |
| Node.jsバージョン管理 | fnm（Windows向け nvm相当） |
| パッケージマネージャ | pnpm（corepack経由） |
| ビルド | Windowsネイティブビルド |
| CI/CD | ローカルビルドのみ（当面） |
| ライセンス | MIT |

### 前提ツール

```powershell
# 1. Visual Studio Build Tools（MSVCリンカに必要）
#    https://visualstudio.microsoft.com/visual-cpp-build-tools/
#    「C++によるデスクトップ開発」ワークロードを選択

# 2. Rustup
winget install Rustlang.Rustup

# 3. nightlyツールチェーン（インストールのみ。プロジェクト内は rust-toolchain.toml で自動切替）
rustup toolchain install nightly

# 4. fnm（Node.jsバージョン管理）
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
