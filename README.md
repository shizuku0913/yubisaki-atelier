# ゆびさきアトリエ v1.5.0

子どもが指で絵の具を出し、混ぜ、作った色で絵を描けるWebアプリです。

## v1.5.0 の変更

- 指を押し続けた時間に応じて、へこみと周囲の盛り上がりが深くなる
- 長押し約0.3秒で追加の短い触覚フィードバック
- 混ぜる速度に応じて、進行方向への伸びと横揺れを強化
- 指を離したあと、直前の移動方向を使って絵の具が実際のCanvas上で少し戻る
- 戻り表現を単なるCSS演出から、薄い画素の再配置を伴う弾性 settling へ改善
- Service Worker のキャッシュを v1.5.0 に更新

## GitHubへ反映する方法

1. ZIPを展開
2. 中身をローカルの `yubisaki-atelier` フォルダへ上書きコピー
3. GitHub Desktopで変更を確認
4. Summaryに `feat: add pressure hold and elastic paint settling` と入力
5. `Commit to main` → `Push origin`

## 動作確認

- 絵の具の上を約0.5秒長押しすると、徐々に深くへこむ
- 指をゆっくり動かすと粘って伸び、速く動かすと長く引かれる
- 指を離すと、最後に動かした方向から小さく揺れながら戻る
- 空の皿部分では変形しない
- 振動は対応するAndroidブラウザでのみ動作する

GitHub Pages: `https://shizuku0913.github.io/yubisaki-atelier/`
