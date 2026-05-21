# PDFラスタライズにpdfium-renderを使用する

PDF差分表示のためのラスタライズライブラリとして、Rustクレート `pdfium-render` を採用する。stable Rustでの動作を確認済み（骨格セットアップ時はnightlyとの互換性エラーで除外していたが解決）。

## Considered Options

- **pdf.js**（フロントエンドでCanvas描画）：JS資産が使えるが、レンダリングをRust側に統一できない。
- **Windows PDF API（WinRT経由）**：OS標準だがTauri + Rustからの呼び出しが複雑。
- **mupdf**：軽量だがRustバインディングの成熟度が低い。
- **pdfium-render（採用）**：Googleの pdfium をRustから扱えるバインディング。高品質・高精度で、stable Rustでの動作確認済み。
