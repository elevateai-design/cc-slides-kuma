# cc-slides — AI セールススライド自動生成システム

サービス仕様書（Markdown）を渡すだけで、プロ品質のセールススライド画像を自動生成するツールです。

## 動作イメージ

```
input/brief.md（仕様書）
    ↓ Claude API（スライド構成生成）
slides/image-design.json（設計ファイル）
    ↓ Gemini API（画像生成）
slides/output/（PNG画像 × 26枚）
```

## セットアップ（初回のみ）

### 1. リポジトリをクローン
```bash
git clone <repo-url>
cd cc-slides
```

### 2. 依存パッケージをインストール
```bash
cd slides/engine && npm install
```

### 3. APIキーを設定
```bash
cp .env.example .env
```

`.env` を開いて2つのキーを入力してください：

| キー | 取得先 |
|-----|--------|
| `GOOGLE_AI_API_KEY` | https://aistudio.google.com/apikey |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ |

---

## 使い方

### 基本（仕様書から全自動生成）

```bash
node slides/engine/run.js --brief input/brief-template.md
```

`slides/output/` に PNG が出力されます。

### オプション

| オプション | 説明 |
|-----------|------|
| `--brief <path>` | 仕様書ファイルのパス |
| `--out <dir>` | 出力先ディレクトリ（デフォルト: `slides/output`） |
| `--plan-only` | 設計JSONだけ生成（画像生成しない） |
| `--generate-only` | 既存の設計JSONから画像だけ生成 |

### 顔写真を合成する（オプション）

```bash
node slides/engine/composite.js \
  --slide slides/output/slide-10.png \
  --photo input/photos/mikami.jpg \
  --out slides/output/slide-10-final.png
```

---

## 仕様書の書き方

`input/brief-template.md` をコピーして編集してください。

```bash
cp input/brief-template.md input/my-brief.md
```

主な記入項目：

- 商品名 / キャッチコピー / セミナー名
- ターゲットの悩み
- 価格 / 価値総額
- 講師情報（名前・実績・顔写真パス）
- 商品構成・特典
- スタイル（`manus` / `stripe` / `apple` など10種）

---

## スタイル一覧

| スタイル | 雰囲気 |
|---------|--------|
| `manus` | Manus AI風。薄ブルー×ネイビー、洗練されたビジネス感 |
| `stripe` | Stripe風。純白×ダークネイビー×パープル |
| `apple` | Apple風。ミニマル、大きな余白 |
| `google` | Google風。マテリアルカラー、フレンドリー |
| `mckinsey` | McKinsey風。白×ネイビー、データ重視 |
| `notion` | Notion風。ソフト、読みやすさ重視 |
| `figma` | Figma風。パープル×ティール、モダン |
| `canva` | Canva風。パステル、カジュアル |
| `netflix` | Netflix風。ダークテーマ、インパクト重視 |
| `nike` | Nike風。白黒+蛍光、エネルギッシュ |
| `muji` | 無印風。ベージュ×茶、ナチュラル |

---

## ディレクトリ構成

```
cc-slides/
├── .env.example          ← APIキー設定のテンプレート
├── README.md             ← このファイル
├── examples/
│   └── cc-bootcamp.json  ← few-shot例（Claude の参考資料）
├── input/
│   ├── brief-template.md ← 仕様書テンプレート（これを編集する）
│   └── photos/           ← 顔写真（.jpg/.png）
├── setup/
│   └── gemini-api.md     ← Gemini APIセットアップ手順
└── slides/
    ├── engine/
    │   ├── run.js         ← メインエントリーポイント
    │   ├── plan.js        ← 仕様書 → 設計JSON（Claude API）
    │   ├── generate.js    ← 設計JSON → PNG画像（Gemini API）
    │   ├── composite.js   ← 顔写真合成（sharp）
    │   └── package.json
    └── output/            ← 生成画像の出力先（gitignore済み）
```

---

## 品質の仕組み

スライドの質は `examples/cc-bootcamp.json` に収録された **few-shot例** によって担保されています。

Claude API はこの例を参照しながら：
- 各スライドの `purpose`（レイアウト設計）を記述
- テキストを体言止めで統一
- セールス構成の型（表紙→問題提起→商品詳細→価格→CTA）に沿って構成

---

## 注意事項

- 画像生成（Gemini）は1枚あたり数秒〜十数秒。26枚で5〜10分程度
- 日本語テキストの描画精度は100%ではない（Gemini APIの制限）
- APIの利用料金が発生します（Gemini + Anthropic）
