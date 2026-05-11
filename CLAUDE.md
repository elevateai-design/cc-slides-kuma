# cc-slides — AI セールススライド自動生成システム

サービス仕様書（Markdown）を渡すだけで、プロ品質のセールススライド画像を自動生成するツール。
Claude API でスライド構成・テキストを設計し、Gemini API で PNG 画像を生成する。

---

## セットアップ（初回のみ）

このリポジトリを開いたら、まず以下を確認・実行する。

### 1. 依存パッケージのインストール

```bash
cd slides/engine && npm install
```

### 2. APIキーの設定

`.env` ファイルがなければ作成する：

```bash
cp .env.example .env
```

`.env` を開いて2つのキーを入力：

```
GOOGLE_AI_API_KEY=（Gemini APIキー）
ANTHROPIC_API_KEY=（Anthropic APIキー）
```

- Gemini APIキー取得: https://aistudio.google.com/apikey
- Anthropic APIキー取得: https://console.anthropic.com/
- 詳細手順: `setup/gemini-api.md`

---

## 使い方

### 基本コマンド（仕様書 → スライドPNG 全自動）

```bash
node slides/engine/run.js --brief input/brief-template.md
```

`slides/output/` に `slide-1.png` 〜 `slide-N.png` が出力される。

### オプション

| オプション | 説明 |
|-----------|------|
| `--brief <path>` | 仕様書ファイルのパス（必須） |
| `--out <dir>` | 出力先ディレクトリ（デフォルト: `slides/output`） |
| `--plan-only` | 設計JSONだけ生成して終了（画像生成しない） |
| `--generate-only` | 既存の `slides/image-design.json` から画像だけ生成 |

### 仕様書の書き方

`input/brief-template.md` をコピーして編集する：

```bash
cp input/brief-template.md input/my-brief.md
```

記入項目：商品名・キャッチコピー・ターゲット・価格・講師情報・商品構成・特典・スタイル

**スタイル選択肢：** `manus` / `stripe` / `apple` / `google` / `mckinsey` / `notion` / `figma` / `canva` / `netflix` / `nike` / `muji`

---

## パイプライン

```
input/brief.md（仕様書）
    ↓ plan.js（Claude API）
slides/image-design.json（スライド設計JSON）
    ↓ generate.js（Gemini API）
slides/output/slide-1.png 〜 slide-N.png
```

### 各ファイルの役割

| ファイル | 役割 |
|---------|------|
| `slides/engine/run.js` | パイプライン全体の実行エントリーポイント |
| `slides/engine/plan.js` | 仕様書 → image-design.json（Claude API使用） |
| `slides/engine/generate.js` | image-design.json → PNG画像（Gemini API使用） |
| `slides/engine/composite.js` | 顔写真を生成済みスライドに合成（sharp使用） |
| `examples/cc-bootcamp.json` | few-shot例（Claude がスライド品質の参考にする） |

---

## 顔写真の合成（オプション）

講師写真を `input/photos/` に置き、生成後に合成する：

```bash
node slides/engine/composite.js \
  --slide slides/output/slide-10.png \
  --photo input/photos/mikami.jpg \
  --out slides/output/slide-10-final.png
```

---

## トラブルシューティング

| エラー | 対処 |
|-------|------|
| `ANTHROPIC_API_KEY が設定されていません` | `.env` にキーを追加 |
| `GOOGLE_AI_API_KEY が設定されていません` | `.env` にキーを追加 |
| `npm install を実行してください` | `cd slides/engine && npm install` |
| JSON パースエラー | `slides/image-design-debug.txt` を確認 |

---

## 注意事項

- 全枚数生成は5〜10分程度かかる
- Gemini API の日本語描画精度は100%ではない（稀に文字が崩れる）
- APIの利用料金が発生する（Gemini + Anthropic）
