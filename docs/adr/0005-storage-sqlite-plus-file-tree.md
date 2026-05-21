# .velgit/はSQLite（メタデータ）＋ファイルツリー（PDF）で構成する

> **⚠️ ADR-0017によって置き換えられました。** PDFストレージはgitオブジェクトストアに一本化。SQLiteは維持。

`.velgit/` 内のデータ保存戦略として、コミット・図渡しのメタデータはSQLite（`velgit.db`）に、PDFのバイナリはcontent-addressedなファイルツリー（`objects/{hash}/`）に分けて保存する。

```
.velgit/
├── velgit.db
└── objects/
    └── {content-hash}/
        └── {filename}.pdf
```

## Considered Options

- **SQLite単体**（バイナリをBLOBとして格納）：単一ファイルで完結するが、PDFをDBの外から直接開けない。大量PDFでDB肥大化。
- **JSONファイル群**：人が読めるが同時書き込みに弱く、大量コミットでの検索が遅い。
- **SQLite＋ファイルツリー（採用）**：メタデータのクエリはSQLiteが担い、PDFは素ファイルとして保持するためファイルマネージャから直接参照できる。
