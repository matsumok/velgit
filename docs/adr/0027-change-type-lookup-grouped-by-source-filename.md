# 系譜履歴のchange_type取得はcommand層でsource_filenameごとにグルーピングして解決する

ADR-0026（Drawing Lineage）に付随する実装判断。

## Context

`lineage_history` は複数のファイル名にまたがるコミット履歴を返す。各エントリには `source_filename`（predecessor 由来の場合はそのファイル名、現ファイルは None）が付く。

`get_change_types_for_file(oids, filename)` は「OIDリスト × 1ファイル名」の形式で `commit_files` テーブルを引く設計になっている。系譜履歴では OID が複数のファイル名に分散するため、単一呼び出しでは正しい change_type を取得できない。

## Decision

DB の `get_change_types_for_file` API は変更せず、`get_commit_history` コマンド内で `source_filename` ごとに OID をグルーピングし、ファイル名ごとに個別クエリを発行して結果をマージする。

```rust
for (fname, oids) in groups {
    let partial = db.get_change_types_for_file(&oids, &fname).await...;
    acc.extend(partial);
}
```

実運用では系譜チェーンの深さは 1〜2 が上限のため、クエリ回数は最大 2〜3 回であり性能上の問題はない。

## Consequences

- DB インターフェースをシンプルに保てる（単一ファイル名の仮定を維持）
- command 層にグルーピングロジックが残り、`get_commit_history` が若干冗長になる
- 将来、系譜チェーンが深くなる場合や N+1 が懸念になった場合は `get_change_types_for_entries(entries: &[(oid, filename)])` を DB 層に追加して command 層のグルーピングを削除できる（SQL は `WHERE (commit_oid = ? AND filename = ?) OR ...` で実装可能）
