# Shizuku Engine 4.0 α — v0.5 “Grip”

**Shizuku Engine** は、子どもが「本物の絵の具を指で触っている感覚」をデジタル上で再現することを目指す、**ゆびさきあとりえ**専用のペイント物理エンジンです。

## v0.5 Grip Constraint 2.0

- 指そのものではなく、少し遅れて追従する「グリップアンカー」を追加
- 指で触れた絵の具を面として保持し、最大78粒子まで段階的につかむ
- 移動中も指の下に入った絵の具を少量ずつ追加捕捉
- つかんだ粒子の力を周囲へ伝え、点ではなく首状に伸びる挙動へ変更
- ゆっくり引くと長く伸び、速く引くほど早く切れる破断モデルを追加
- v0.3の粒子上限・アイドル休止・30fps描画を維持

## テスト方法

1. `index.html` を開く
2. 絵の具の中央を1秒ほど押さえてから、ゆっくり横へ引く
3. 指より少し遅れて絵の具が面として付いてくることを確認
4. 同じ距離を素早く引き、ゆっくり引いた時より早く離れるか確認
5. 円を描くように動かし、周囲の絵の具も連なって動くか確認
6. 「えのぐをたす」を上限まで押しても停止しないことを確認

## 次の開発項目

- Viscosity Model 1.0
- Surface Renderer
- Multi-color Mixing


## v0.5 — Viscosity 1.0

- Added local velocity matching so nearby paint moves as a cohesive wet mass
- Added short motion memory for delayed follow-through and delayed stopping
- Added shear-thinning: slow pulls stretch farther, fast pulls tear sooner
- Added strain-aware elastic relaxation after release
- Preserved v0.3 performance limits and v0.4 grip constraints
