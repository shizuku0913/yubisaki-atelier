# ゆびさきアトリエ v1.2.0

子どもが指で絵の具を出し、混ぜ、作った色で絵を描けるWebアプリです。

## v1.2.0 の変更

- `FingerDynamics` を追加し、指を動かす速さを混色へ反映
- ゆっくり混ぜると細いマーブル模様が長く残る
- 速く混ぜると広く伸び、均一な色へ早く近づく
- 混色中の粘度・混ざり具合を Paint Engine に記録
- Service Worker のキャッシュ名を更新

## GitHubへ反映する方法

1. ZIPを展開
2. 中身をローカルの `yubisaki-atelier` フォルダへ上書きコピー
3. GitHub Desktopで変更を確認
4. Summaryに `feat: add speed-sensitive finger mixing` と入力
5. `Commit to main` → `Push origin`

## 動作確認

- 指をゆっくり動かす: 色筋がはっきり残る
- 指を速く動かす: 絵の具が広く伸び、短時間で均一になる
- 2本指の絵の具出し、水、ラメ、色図鑑、お絵かきが従来どおり動く

GitHub Pages: `https://shizuku0913.github.io/yubisaki-atelier/`
