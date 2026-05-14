#!/usr/bin/env node

/**
 * plan.js - サービス仕様書 → image-design.json 自動生成
 * Claude API を使って、brief.md からスライド設計JSONを2段階で生成する
 *
 * Usage:
 *   node slides/engine/plan.js --brief input/brief-template.md --out slides/image-design.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

// ─── .env 読み込み ───────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ─── スタイル定義 ─────────────────────────────────────────────

const STYLE_MAP = {
  manus: {
    style_base: "stripe",
    style_description: "Manus AI inspired design system. BACKGROUND: subtle light blue-to-white gradient (#EEF4FF top to #FFFFFF bottom). Top edge: thin 3px horizontal accent line in #2563EB. Optional decorative elements: very low-opacity (5-10%) large circles in upper-right corner only. Do NOT place any numbers, digits, or text as watermarks or ghost elements in any corner. TYPOGRAPHY: H1 extra-bold dark navy #0F2C6E, left-aligned, giant size; H2 medium-weight bright blue #2563EB, smaller; body small dark gray #374151. COLOR PALETTE: dark navy #0F2C6E, bright blue #2563EB, medium blue #60A5FA, light blue #BFDBFE, very light blue #EEF4FF, white #FFFFFF. UI COMPONENTS: feature cards as soft light-blue rounded rectangles (8-12px radius) WITHOUT drop shadows; bullet points as small filled bright blue circles. CHARTS: 4-tone blue gradient bars. LAYOUT: generous whitespace 30%+, strict grid, left-aligned headlines. NEVER use emoji. Flat line-art icons only.",
  },
  teal: {
    style_base: "teal",
    style_description: "Modern teal and orange business presentation. BACKGROUND: pure white (#FFFFFF). CORE PALETTE: teal #1BADA6, orange-amber #F5A623, dark gray #333333, light gray #F5F5F5, white #FFFFFF. HEADER BAR: full-width solid teal (#1BADA6) rectangle at top of each slide with white bold title text left-aligned; bottom edge of header has a subtle diagonal or wave cut transitioning to white. SLIDE NUMBERS: large bold teal number in top-right corner. TYPOGRAPHY: title large bold white (inside teal header); body dark gray #333333; accent labels in orange #F5A623 on teal background or teal on white. CARDS: white background with teal top-accent bar (4-6px); clean border or very subtle shadow. ICONS: flat simple icons in white (on teal) or teal (on white). CHARTS: bar charts and donut/pie charts using teal (#1BADA6) and orange (#F5A623) as the two primary data colors; clean white background. FOOTER: small gray text on left (label) and right (branding) at bottom edge. LAYOUT: clean structured grid, generous whitespace, data-focused. NEVER use emoji.",
  },
  premium: {
    style_base: "premium",
    style_description: "Premium luxury seminar design system. BACKGROUND: very deep dark navy (#0D1B3E) with subtle low-opacity hexagon honeycomb grid pattern overlay (5-8% opacity). CORE PALETTE: deep navy #0D1B3E, rich gold #C9A842, white #FFFFFF, light silver #C0C0C0. CORNER DECORATIONS: ornate gold filigree arabesque corner embellishments on all four corners of every slide — this is mandatory. GEOMETRIC DECOR: gold outline geometric polyhedra (diamond, icosahedron, octahedron wireframe shapes) as right-side or corner decorative elements. SECTION LABELS: gold-bordered dark rectangular badge in upper-left area (e.g. '1. DEMO 1') with gold border and small label text. TYPOGRAPHY: H1 extra-large extra-bold white; H2/sub text gold (#C9A842); body white or light silver (#C0C0C0); key statistics in oversized bold gold. CARDS: dark navy panels (#0F2040) with full gold border or gold top-bar accent; subtle inner gradient navy-to-slightly-lighter; rounded corners 6px; NO drop shadows. ICONS: gold line-art outline icons only, centered above card text. NUMBER CIRCLES: filled gold circles with dark number text for ordered lists. DIVIDERS: thin gold horizontal lines below title. GLOW EFFECTS: subtle gold radial sparkle on key numbers or CTA elements. TABLES: dark navy rows with gold-bordered highlight row for emphasis. LAYOUT: left-aligned headlines, 25%+ whitespace, strict grid. NEVER use emoji. Flat line-art icons only.",
  },
  corporate: {
    style_base: "corporate",
    style_description: "Clean Japanese B2B corporate presentation design. BACKGROUND: pure white (#FFFFFF) throughout. CORE PALETTE: white #FFFFFF, teal-green #3DBFA0, purple-blue #6B5CE7, dark navy #1A2340, light gray #F5F5F5, dark gray #333333. TYPOGRAPHY: H1 large bold dark navy; accent/highlight words in teal #3DBFA0; body dark gray #333333; small labels medium gray. LAYOUT: clean structured grid, generous whitespace, left-aligned or center-aligned headlines. CARDS: white cards with light gray border or 2px drop shadow; teal top-accent bar (4px) on feature cards; rounded corners 4-8px. ICONS: flat colored icons in teal or purple, placed above card text. CHARTS: bar charts in teal-to-purple gradient. TABLES: white rows with teal header background (#3DBFA0 text white), alternating very light gray rows; purple accent for secondary columns. ACCENT LINES: thin orange (#FF8C42) or teal horizontal rule below main title. DECORATIVE NUMBERS: large semi-transparent teal numeral as background element behind section headers. LOGO PLACEMENT: company logo small in bottom-left corner. PROCESS ARROWS: teal chevron arrows between process steps. OVERALL: professional, readable, structured — Japanese enterprise business document style. NEVER use emoji.",
  },
};

// ─── システムプロンプト ───────────────────────────────────────

function buildSystemPrompt(fewShotJson) {
  return `あなたは日本語セールスプレゼンテーション設計の専門家です。
サービス仕様書（brief.md）を読み、image-design.json を生成します。

## image-design.json スキーマ

\`\`\`json
{
  "type": "series",
  "style_base": "スタイル名（stripe/apple/mckinsey等）",
  "style_description": "デザインシステムの詳細説明（英語）",
  "preset": "video-slide",
  "images": [
    {
      "purpose": "このスライドの役割・視覚設計・感情的目標を2〜3文で具体的に記述（日本語）",
      "text": {
        "main": "メインタイトル（体言止め必須・口語禁止）",
        "sub": "サブタイトル（口語OK・短く）",
        "other": ["要素1", "要素2", "要素3"]
      }
    }
  ]
}
\`\`\`

---

## 絶対ルール

### テキストルール
- **main（メインタイトル）は必ず体言止め**（名詞・名詞句で終わる）
  - NG: 「AIを活用しましょう」「価値があります」
  - OK: 「AI活用、5つの段階」「本体だけで、¥649,000相当」
- **mainに口語・感嘆符・動詞終わりを使わない**
- **subは口語OK**（「あなたは今、どのレベル？」等）
- **other の各要素は表示するテキストのみ**。スタイル指示（「白太字」「ゴールド」「右寄せ」等）を括弧で付けない
- **other にデザイン・色・フォント指示を含めない**。それらは purpose に書く
- **テキストに絵文字を入れない**

### デザインルール
- フラットデザイン・ラインアートアイコンのみ
- 3D・グロッシー・フォトグラフィック効果禁止
- ゴースト数字・透かし数字・コーナー装飾数字禁止
- 余白30%以上
- 16:9レイアウトで横並び3要素以上は必ずHORIZONTAL配置

### purposeの書き方（品質の核心）
purposeはGemini画像生成AIへの設計指示書。具体的であるほど良い。

**BAD（抽象的・短すぎ）:**
"表紙スライド"
"価格を見せるスライド"

**GOOD（具体的・視覚的・感情的目標あり）:**
"オープニングタイトル。左寄せの巨大ヘッドラインがネイビーで主役（2行折り返しOK）。直下にブライトブルーのサブタイトル。最下部にグレーのフッターで主催と講師名を小さく配置。右側に極薄ブルーの大円を1〜2個配置して動きを出す。"

"価格提示スライド。縦一列レイアウトが主役。上部中央に大きなネイビーで価値総額を表示。直下中央にブライトブルーの大きな下向き矢印↓。矢印の直下に画面の40%を占める超大ネイビー数字で価格を中央に鎮座させる。最下部に極小グレーで支払い方法3種を横並び（目立たせない）。"

purposeに含めるべき要素：
1. このスライドが視聴者の心に起こす変化（役割）
2. 具体的なレイアウト（何を左に、右に、中央に）
3. 視覚要素の大きさ・色・配置（「画面の40%を占める」「極薄ブルーの円」等）
4. 配列の方向（横並び/縦並び）を明示

---

## セールス構成の型（スライドの流れ）

以下を基本フレームとして、briefの内容に応じて枚数を調整：

| セクション | 役割 | 枚数目安 |
|-----------|------|---------|
| 表紙 | 第一印象・セミナー名・主催 | 1枚 |
| 問題提起 | ターゲットの外部的な痛み（数字・事実） | 1枚 |
| 自分ごと化 | 現状の自分はどこにいるか（5段階等） | 1枚 |
| 根本原因 | なぜ解決できていないか（3要素） | 1枚 |
| 市場機会 | 需要は確実にある（データ） | 1枚 |
| 商品説明 | 何ができるか（定義・コード不要等） | 1枚 |
| 先行者利益 | 今が早い者勝ちである証拠 | 1枚 |
| デモ | 実際に動くものを見せる | デモ数×1枚 |
| 権威者実績 | 信頼構築（みかみ等） | 講師数×1枚 |
| 実行者実績 | 現場の証拠 | 1枚 |
| 1期生実績 | 受講生の声・実績 | 1枚 |
| 橋渡し | 実績→自分ごと化 | 1枚 |
| 競合差別化 | なぜここか（VS比較） | 1枚 |
| 受講フロー | 購入から完了まで（4ステップ等） | 1枚 |
| 商品詳細① | コンテンツ①（講座等）の詳細 | 1枚 |
| 商品詳細② | コンテンツ②（ブートキャンプ等）の詳細 | 1枚 |
| 商品詳細③ | コンテンツ③（コミュニティ等）の詳細 | 1枚 |
| 本体合計 | 価値の積み上げ | 1枚 |
| 特典①〜 | 各特典の詳細 | 特典数に応じて |
| 総合計 | 本体＋特典の合計価値 | 1枚 |
| 価格提示 | 価値総額→価格への劇的な落差 | 1枚 |
| 反論処理 | Q&A形式で不安を消す | 1枚 |
| ROI | 1日あたりのコスト等で価格を再フレーム | 1枚 |
| CTA | 申し込みボタン・特別価格 | 1枚 |

---

## few-shot 例（このクオリティを目指す）

以下は実際に使用した高品質な image-design.json です。
purpose の書き方・text の構成・スライドの流れを参考にしてください：

${fewShotJson}

---

## 出力形式

- 有効なJSONのみ出力してください
- \`\`\`json や \`\`\` で囲まないでください
- コメントを含めないでください
- style_base と style_description は指示通りに設定してください
- preset は必ず "video-slide" にしてください`;
}

// ─── メイン処理 ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let briefPath = null;
  let outPath = path.join(projectRoot, "slides", "image-design.json");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--brief" || args[i] === "-b") { briefPath = args[++i]; }
    else if (args[i] === "--out" || args[i] === "-o") { outPath = args[++i]; }
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node slides/engine/plan.js --brief input/brief-template.md [--out slides/image-design.json]");
      return;
    }
  }

  if (!briefPath) {
    console.error("Error: --brief が必要です");
    process.exit(1);
  }

  // 相対パスはprojectRoot基準で解決（worktree内からの実行でもファイルが正しい場所に出力される）
  if (!path.isAbsolute(briefPath)) briefPath = path.resolve(projectRoot, briefPath);
  if (!path.isAbsolute(outPath)) outPath = path.resolve(projectRoot, outPath);
  if (!fs.existsSync(briefPath)) {
    console.error(`Error: ファイルが見つかりません: ${briefPath}`);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY が設定されていません");
    console.error(".env に ANTHROPIC_API_KEY=your_key を追加してください");
    process.exit(1);
  }

  let Anthropic;
  try {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default;
  } catch {
    console.error("Error: @anthropic-ai/sdk が見つかりません。npm install を実行してください");
    process.exit(1);
  }

  const brief = fs.readFileSync(briefPath, "utf-8");

  // few-shot 例を読み込み（examples/ から読む。image-design.json を上書きしても壊れない）
  const fewShotPath = path.join(projectRoot, "examples", "cc-bootcamp.json");
  const fewShotJson = fs.existsSync(fewShotPath)
    ? fs.readFileSync(fewShotPath, "utf-8")
    : "（few-shot例なし）";

  // ─── 生成パラメータを取得 ─────────────────────────────────────
  // CRLF正規化（Windows環境対応）
  const briefNorm = brief.replace(/\r\n/g, "\n");

  // 訴求軸
  const appealMatch = briefNorm.match(/^### 訴求軸\n(?:#[^\n]*\n)?([\s\S]+?)(?=\n###|\n##|$)/m);
  const appealAxis = appealMatch ? appealMatch[1].trim() : "収入アップ";

  // ターゲット属性
  const targetMatch = briefNorm.match(/^### ターゲット属性\n(?:#[^\n]*\n)?([\s\S]+?)(?=\n###|\n##|$)/m);
  const targetAttr = targetMatch ? targetMatch[1].trim() : "副業未経験の会社員";

  // 画像枚数
  const countMatch = briefNorm.match(/^### 画像枚数\n(?:#[^\n]*\n)?(\d+)/m);
  const slideCount = countMatch ? parseInt(countMatch[1], 10) : 26;

  // スタイル（新形式: ### スタイル、旧形式: ## スタイル の両方に対応）
  const styleMatch = briefNorm.match(/^#{2,3} スタイル\n(?:#[^\n]*\n)?([\w]+)/m);
  const styleName = styleMatch ? styleMatch[1].trim().toLowerCase() : "manus";
  const style = STYLE_MAP[styleName] || STYLE_MAP.manus;

  console.log(`訴求軸: ${appealAxis}`);
  console.log(`ターゲット: ${targetAttr}`);
  console.log(`画像枚数: ${slideCount}枚`);
  console.log(`スタイル: ${styleName}`);

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(fewShotJson);

  // ─── Stage 1: スライド構成を設計 ─────────────────────────────

  console.log("Stage 1: スライド構成を設計中...");

  // 生成パラメータ指示文（Stage1/Stage2共通で使用）
  const paramInstruction = `
## 生成パラメータ（最優先で反映すること）
- 訴求軸: ${appealAxis}
  → スライド全体のメッセージ・言葉選び・感情設計をこの軸に統一する
- ターゲット属性: ${targetAttr}
  → 悩み・痛み・欲求の描写をこの属性に合わせてカスタマイズする
- 画像枚数: ${slideCount}枚
  → ちょうど${slideCount}枚になるようにスライド構成を調整する（多すぎず少なすぎず）`;

  const stage1 = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `以下のサービス仕様書を読み、最適なスライド構成を設計してください。
各スライドの「番号・タイトル（日本語）・役割・レイアウトタイプ」を箇条書きで列挙してください。
JSONはまだ出力しないでください。
${paramInstruction}

---
${brief}`,
    }],
  });

  const slidePlan = stage1.content[0].text;
  console.log("構成設計完了。コンテンツを生成中...");
  console.log("---");
  console.log(slidePlan);
  console.log("---");

  // ─── Stage 2: image-design.json を生成 ──────────────────────

  console.log("\nStage 2: image-design.json を生成中（1〜2分かかります）...");

  const stage2 = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 16000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `以下のサービス仕様書を読み、最適なスライド構成を設計してください。
各スライドの「番号・タイトル（日本語）・役割・レイアウトタイプ」を箇条書きで列挙してください。
JSONはまだ出力しないでください。
${paramInstruction}

---
${brief}`,
      },
      {
        role: "assistant",
        content: slidePlan,
      },
      {
        role: "user",
        content: `この構成でimage-design.jsonを生成してください。

以下を必ず守ってください：
- style_base: "${style.style_base}"
- style_description: "${style.style_description || `（${styleName}スタイルの詳細説明を英語で記述）`}"
- preset: "video-slide"
- purposeはfew-shot例と同等の具体性・品質で書く
- mainは必ず体言止め
- JSONのみ出力（\`\`\`で囲まない、コメントなし）`,
      },
    ],
  });

  const rawOutput = stage2.content[0].text;

  // JSON を抽出してパース
  let design;
  try {
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");
    design = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("JSON パースエラー:", err.message);
    const debugPath = outPath.replace(".json", "-debug.txt");
    fs.writeFileSync(debugPath, rawOutput);
    console.error(`生出力を保存しました: ${debugPath}`);
    process.exit(1);
  }

  // 出力ディレクトリ作成
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(design, null, 2));

  console.log(`\n完成: ${outPath}`);
  console.log(`スライド枚数: ${design.images.length}枚`);

  // 講師名と写真のマッピングを抽出して保存
  const photos = extractPhotos(briefNorm);
  if (photos.length > 0) {
    const photosPath = outPath.replace(".json", "-photos.json");
    fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));
    console.log(`写真マッピング: ${photosPath}`);
  }
}

// ─── 写真マッピング抽出 ─────────────────────────────────────

function extractPhotos(brief) {
  const photos = [];
  const blocks = brief.split(/^### 講師\d+/m).slice(1);
  for (const block of blocks) {
    const nameMatch = block.match(/名前:\s*(.+)/);
    const photoMatch = block.match(/顔写真:\s*(.+)/);
    if (nameMatch && photoMatch) {
      photos.push({
        name: nameMatch[1].trim(),
        path: photoMatch[1].trim(),
      });
    }
  }
  return photos;
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
