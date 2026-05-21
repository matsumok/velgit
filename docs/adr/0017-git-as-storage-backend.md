# gitをストレージバックエンドとして使用する（ADR-0005を置き換え）

## 決定

PDFのバージョン履歴保存に `.velgit/objects/` の独自ファイルツリーは使用しない。代わりに物件フォルダをgitリポジトリとして初期化し、gitのオブジェクトストアをストレージバックエンドとして使用する。

```
物件フォルダ/
├── .git/
│   └── velgit/
│       └── velgit.db   ← velgit固有メタデータ（gitで追跡しない・ローカルのみ）
└── A-001_1階平面図.pdf（最新の作業コピー）
```

隠しフォルダは `.git/` のみ。`.velgit/` は作らない。

`velgit.db`（図渡し記録・変更種別）はgitで追跡しないため、GitHub pushのバックアップ対象外。PDFの履歴のみGitHubにバックアップされる。これは意図的な割り切り。

velgitの「コミット」操作 = git commitをgit2クレート経由で実行。velgit.dbもPDFと同じgitコミットに含める。

## GitHub push（オプション）

UIにpush/remote操作は一切含めない。GitHubへのバックアップを希望するユーザーはCLIから操作する：

```bash
git remote add origin https://github.com/...
git push origin main
```

PDFサイズが大きいためGitHub pushにはgit-lfsが推奨。LFSは任意設定で、未設定でもローカル動作には影響しない。無料枠（1GB）で試用可能で、必要に応じて有料プラン（$5/50GB/月）に移行できる。

## diff表示

過去バージョンのPDFはgit2クレートで任意コミットから取得する。LFS未設定環境ではgitオブジェクトから直接読み出すため、ローカルdiffは常に動作する。

## ADR-0005との関係

ADR-0005（SQLite + ファイルツリー）を置き換える。SQLiteは維持するが、PDFの保存先をgitオブジェクトストアに一本化することでストレージの二重管理を解消する。

## Considered Options

- **.velgit/objects/ を維持**：diff表示が常に確実・高速だが、gitと二重管理になる。
- **git一本化（採用）**：ストレージがクリーン。GitHubバックアップの拡張性あり。ローカルでの動作は変わらない。
