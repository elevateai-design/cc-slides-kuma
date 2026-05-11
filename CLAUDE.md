# cc-slides — AI セールススライド自動生成システム

サービス仕様書（Markdown）を渡すだけで、プロ品質のセールススライド画像を自動生成するツール。

---

## Claudeへの指示

ユーザーがこのプロジェクトを開いたら、以下のステップを順番に能動的に案内する。
ユーザーが何も言わなくても、まずStep 1から始める。

---

## Step 1：セットアップ確認

以下を順番にチェックし、問題があればその場で解決してから次に進む。

### 1-A. node_modules の確認

```bash
ls slides/engine/node_modules
```

存在しなければ実行：
```bash
cd slides/engine && npm install
```

### 1-B. .env の確認

`.env` ファイルが存在するか確認：
```bash
ls -la | grep .env
```

なければ作成を案内：
```bash
cp .env.example .env
```

`.env` を開いて以下の2つのキーが入力済みか確認する：
- `GOOGLE_AI_API_KEY` — 取得先: https://aistudio.google.com/apikey
- `ANTHROPIC_API_KEY` — 取得先: https://console.anthropic.com/

キーが空欄なら、ユーザーにキーの入力を促す。詳細手順は `setup/gemini-api.md` を参照。

セットアップが完了したら「準備完了です。Step 2に進みます」と伝える。

---

## Step 2：仕様書の準備

ユーザーに確認する：「仕様書（サービスの内容をまとめたMarkdownファイル）はありますか？」

### 仕様書がある場合
パスを教えてもらう。`input/` フォルダに置いてもらうと便利。

### 仕様書がない場合
テンプレートをコピーして一緒に記入する：

```bash
cp input/brief-template.md input/brief.md
```

`input/brief.md` を開いて、以下の項目をユーザーにヒアリングしながら埋める：
- 商品名・キャッチコピー・セミナー名
- ターゲット像・ターゲットの悩み
- 価格・価値総額
- 講師情報（名前・肩書き・実績・顔写真パス）
- 商品構成（コンテンツ①②③）・特典
- スタイル（下記から選択）

**スタイル選択肢：**

| スタイル | 雰囲気 |
|---------|--------|
| `manus` | Manus AI風。薄ブルー×ネイビー、洗練されたビジネス感（推奨） |
| `stripe` | Stripe風。純白×ダークネイビー×パープル |
| `apple` | Apple風。ミニマル、大きな余白 |
| `google` | Google風。マテリアルカラー、フレンドリー |
| `mckinsey` | McKinsey風。白×ネイビー、データ重視 |
| `notion` | Notion風。ソフト、読みやすさ重視 |
| `figma` | Figma風。パープル×ティール、モダン |
| `canva` | Canva風。パステル、カジュアル |
| `netflix` | Netflix風。ダークテーマ、インパクト重視 |
| `nike` | Nike風。白黒＋蛍光、エネルギッシュ |
| `muji` | 無印風。ベージュ×茶、ナチュラル |

仕様書が完成したら「仕様書の準備完了です。Step 3に進みます」と伝える。

---

## Step 3：スライド生成

### 実行前に必ずユーザーに確認する

コマンドを実行する前に、以下を必ずユーザーに提示して「OK」をもらってから進む。
**確認なしに勝手に実行してはいけない。**

```
以下の内容でスライドを生成します。よろしいですか？

- 仕様書: <パス>
- 商品名: <brief から読み取った商品名>
- スタイル: <brief から読み取ったスタイル>
- 推定枚数: <セールス構成から推定>

「はい」で生成開始します。
```

ユーザーから「はい」または同意を得てから実行する。

### 生成コマンド

仕様書のパスを確認し、以下のコマンドを実行する：

```bash
node slides/engine/run.js --brief <仕様書のパス>
```

例：
```bash
node slides/engine/run.js --brief input/brief.md
```

実行中は以下の流れで進む（ユーザーに説明する）：
1. Claude API がスライド構成とテキストを設計（1〜2分）
2. Gemini API が各スライドを画像生成（1枚あたり数秒〜十数秒）
3. `slides/output/` に `slide-1.png` 〜 `slide-N.png` が出力される

完了したら出力フォルダをユーザーに開いてもらう。

---

## Step 4：確認と修正

生成されたスライドをユーザーに確認してもらう。

修正が必要な場合：

| 修正内容 | 対応 |
|---------|------|
| テキストを変えたい | `slides/image-design.json` を編集 → `--generate-only` で再生成 |
| 特定の1枚だけ再生成 | `--slides` オプションで枚数指定 |
| スタイルを変えたい | 仕様書のスタイル欄を変更 → 再度 `run.js` 実行 |
| 仕様書の内容を変えたい | 仕様書を編集 → 再度 `run.js` 実行 |

再生成コマンド例（設計JSONから画像だけ再生成）：
```bash
node slides/engine/run.js --generate-only
```

---

## Step 5：顔写真の合成（オプション）

講師の顔写真を合成する場合：

```bash
node slides/engine/composite.js \
  --slide slides/output/slide-10.png \
  --photo input/photos/講師名.jpg \
  --out slides/output/slide-10-final.png
```

顔写真は `input/photos/` に置いておく。

---

## エラーが出たとき

| エラーメッセージ | 対処 |
|----------------|------|
| `ANTHROPIC_API_KEY が設定されていません` | `.env` に `ANTHROPIC_API_KEY=キー` を追加 |
| `GOOGLE_AI_API_KEY が設定されていません` | `.env` に `GOOGLE_AI_API_KEY=キー` を追加 |
| `npm install を実行してください` | `cd slides/engine && npm install` を実行 |
| JSON パースエラー | `slides/image-design-debug.txt` の内容を確認して報告 |

---

## 注意事項

- 全枚数生成は5〜10分程度かかる
- Gemini API の日本語描画精度は100%ではない（稀に文字が崩れることがある）
- APIの利用料金が発生する（Gemini + Anthropic）
