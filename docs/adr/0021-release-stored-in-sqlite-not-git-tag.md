# 図渡しは git tag / commit ではなく SQLite に保存する

## 決定

図渡し（Drawing Release）を git の tag や commit として実装しない。図渡しのメタデータと対象図面の選択は SQLite（`velgit.db`）に保存する。

## 理由

図渡しは全図面のサブセット選択を含むスナップショットである。git の commit や tag はリポジトリ全体のツリースナップショットであり、「どの図面を選んだか」という部分選択を表現できない。

```
releases テーブル
  id, name, kind, recipient, commit_oid, created_at, created_by

release_drawings テーブル
  release_id, filename   ← 部分選択をここで表現
```

`commit_oid` は「その図渡しを作成した時点の HEAD」への参照として保持するが、これは git オブジェクトへのポインタであり、図渡し自体が git オブジェクトになるわけではない。

## Considered Options

- **git tag として実装**：tag は全ツリーを指すため、対象図面の部分選択を表現できない。却下。
- **git commit として実装**：同上。全ファイルが含まれることが前提になってしまう。却下。
- **SQLite（採用）**：`release_drawings` テーブルで任意のファイル名セットを記録できる。図渡しの種別・相手先・作成者といったメタデータも自然に保持できる。
