# velgit

建築・設計事務所向けの図面バージョン管理ツール。A3サイズのPDFを対象とし、Windowsの共有ドライブ上でチームが図面の変更履歴を管理できる。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **バックエンド**: Rust (Tauri v2)
- **DB**: SQLite (sqlx)
- **リポジトリ**: git2 (libgit2)

## 開発環境セットアップ

```bash
pnpm install
pnpm tauri dev
```

## ビルド

```bash
pnpm tauri build
```

## 推奨IDE

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
