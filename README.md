# ゆびさきアトリエ v1.1.0

子どもが指で絵の具を出し、混ぜ、作った色で絵を描けるWebアプリです。

## この版の変更

- 1ファイルだったHTMLを `index.html` / `css/main.css` / `js/app.js` に分離
- Paint Engine、Mix Engine、Rendererの基盤ファイルを追加
- PWA用の `manifest.json` と `sw.js` を最新構成に対応
- 現在の操作・色図鑑・保存・ラメ・水の機能を維持

## GitHubへ反映する方法

1. ZIPを展開する
2. 中身をローカルの `yubisaki-atelier` フォルダへ上書きコピーする
3. GitHub Desktopで変更を確認する
4. Summaryに `refactor: split app into maintainable files` と入力する
5. `Commit to main` → `Push origin`

## 起動

GitHub Pages公開後、以下のURLで確認できます。

`https://shizuku0913.github.io/yubisaki-atelier/`

ローカル確認では、VS CodeのLive ServerなどHTTPサーバー経由で開くとPWA機能も確認できます。
