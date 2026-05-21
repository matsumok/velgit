# SQLiteドライバはsqlxを使用し、スキーマ管理はsqlx migrateで行う

SQLiteの操作にはRustクレート `sqlx`（SQLite feature）を使用する。`sqlx migrate` によりスキーマのバージョン管理を行い、物件フォルダを開いた際に `velgit.db` のスキーマが古ければ起動時に自動で順次マイグレーションを適用する。

複数の物件フォルダが異なるバージョンのスキーマを持っている可能性があるため、自動マイグレーションは必須。`migrations/` フォルダにSQLファイルを連番で管理する。

## Consequences

rusqliteではなくsqlxを採用することで、非同期Rustとの統合がスムーズになる。sqlxのコンパイル時クエリ検証（`query!` マクロ）を活用してSQLの型安全性を確保する。
