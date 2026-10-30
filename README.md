# RosenCreator

写真のような「沿線マップ」を自分で作れる、HTML / CSS / JavaScript だけのアプリです。フレームワークやビルドは不要です。

## 使い方（編集）

### ローカルで使う場合（サーバー不要・おすすめ）

`RosenCreator.html` をダブルクリックしてブラウザで開くだけで使えます。CSS / JavaScript をすべて1ファイルに埋め込んである単体版で、サーバーを立てる必要はありません。埋め込みコードの生成もこのファイルだけで動きます。

### サーバー / GitHub Pages で使う場合

GitHub Pages で公開するか、ローカルで簡易サーバーを立てて `index.html` を開いてください。

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

- **駅を登録**: 左パネルの「駅を登録」に駅名を入れて追加。マップ上でドラッグして配置、名前や座標も編集できます。
- **路線を作る**: 「路線を作る」で路線名と色を追加し、「駅をクリックして追加する」を ON にして、駅を順番にクリックすると線が引かれます。駅の順番変更・環状（ループ）にも対応しています。線は自動でなめらかな曲線になります。
- **画像を挿入**: 画像URLの追加、または画像ファイルのアップロードができます。ドラッグで移動、幅も変えられます。
- 作業内容はブラウザに自動保存されます。「JSONを書き出す / 読み込む」でバックアップや共有ができます。

## 埋め込み（iframe ではありません）

エディタ右上の「埋め込みコードを作る」を押すと、コピペ用のコードが出ます。

- CSS と JS の中身を含んだ**自己完結版**なので、表示先のページにそのまま貼るだけで動きます。RosenCreator のファイルを別途置く必要はありません。
- `embed.html` としてダウンロードもできます。

ファイルに分けて使いたい場合は、`rosen.css` と `rosen.js` を表示先に置いて、こう書いても動きます。

```html
<link rel="stylesheet" href="rosen.css">
<div id="my-rosen"></div>
<script src="rosen.js"></script>
<script>
  RosenCreator.render(document.getElementById('my-rosen'), {
    width: 1000, height: 760, background: '#f7f3e8',
    stations: [
      { id: 's1', name: '新宿', x: 415, y: 360 },
      { id: 's2', name: '池袋', x: 515, y: 220 }
    ],
    lines: [
      { id: 'l1', name: '山手線', color: '#80c241', width: 11, closed: false, stationIds: ['s1', 's2'] }
    ],
    images: [
      { id: 'i1', src: 'https://example.com/landmark.png', x: 800, y: 200, width: 140, alt: '' }
    ]
  });
</script>
```

座標は `width × height`（初期値 1000 × 760）の仮想キャンバス上の値で、表示サイズに合わせて自動で伸縮します。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `RosenCreator.html` | サーバー不要の単体版エディタ（ダブルクリックで起動） |
| `index.html` | エディタ本体 |
| `editor.css` / `editor.js` | エディタ専用（埋め込みには不要） |
| `rosen.css` / `rosen.js` | 埋め込み先でマップを表示するための本体 |
