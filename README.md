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


## v1.2.1
- Fixed black mixing trails by removing multiply compositing from finger smudging.
- Added coloured ribbon-based marble smudging.
- Kept marble patterns visible longer before final uniform mixing.
- Changed the service worker to network-first and bumped the cache version.


## v1.4.0 Local Paint Feel
- 指の下だけを局所的に押し潰すオーバーレイを追加
- 混ぜる方向へ絵の具が伸びる局所変形
- 指を離した時に、にゅるっと戻る減衰アニメーション
- 対応端末では短い振動フィードバックを追加


## v1.4.1
- Fixed local deformation canvas being cleared on every move.
- Strengthened press dent, displaced rim, sticky stretch and release wobble.
- Fixed CSS water-bloom positioning on mobile browsers.
- Added animated paint-canvas water diffusion and a visual haptic fallback.
- Note: vibration depends on browser/device support; iOS browsers do not support `navigator.vibrate`.
