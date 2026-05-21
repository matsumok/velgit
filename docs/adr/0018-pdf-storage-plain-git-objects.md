# PDFはLFSなしの素のgitオブジェクトとして保存する

PDFのバージョン保存にGit LFSは使用せず、通常のgitオブジェクト（`.git/objects/`）として保存する。

## 理由

- Samba上の日常運用ではLFSの有無は動作に影響しない
- git-lfsのインストール・設定をスタッフ全員に求めると導入コストが上がる
- GitHubへのpushは現時点で必須要件ではない（オプション機能）
- 後からLFSへの移行が必要になった場合、`git lfs migrate import --include="*.pdf"` で既存履歴ごと変換できる

## GitHub pushとの関係

LFSなしの状態でGitHub pushを試みると、大きなPDFファイル（100MB超）でリジェクトされる場合がある。GitHub pushを本格利用する際はLFS移行が必要。

## 将来のLFS移行手順（メモ）

```bash
git lfs install
git lfs migrate import --include="*.pdf" --everything
git push origin main --force
```

全ユーザーが以降 `git-lfs` のインストールが必要になる。
