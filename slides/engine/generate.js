#!/usr/bin/env node

/**
 * スライド画像生成エンジン（シンプル版）
 * スライド画像生成エンジン
 *
 * Usage:
 *   node slides/engine/generate.js --design slides/image-design.json --out slides/output
 *   node slides/engine/generate.js --design slides/image-design.json --out slides/output --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

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

const STYLES = {
  stripe: {
    name: "stripe",
    prompt: `Stripe product-page aesthetic. STRICT COLOR PALETTE: background #FFFFFF, main #0A2540 (dark navy), accent #635BFF (purple). Extra-bold gothic titles, generous whitespace (30%+), subtle geometric patterns at 5-10% opacity.`,
  },
  apple: {
    name: "apple",
    prompt: `Apple product-page aesthetic. STRICT COLOR PALETTE: background #FFFFFF, main #1D1D1F, accent #86868B. Ultra-minimal, dramatic whitespace (40%+), one hero element dominates. Giant typography as the visual itself.`,
  },
  google: {
    name: "google",
    prompt: `Google Material Design aesthetic. STRICT COLOR PALETTE: background #FFFFFF, main #202124, accents #4285F4 (blue), #EA4335 (red), #34A853 (green), #FBBC05 (yellow). Friendly, rounded corners, clean grid.`,
  },
  mckinsey: {
    name: "mckinsey",
    prompt: `McKinsey/BCG consulting-slide aesthetic. STRICT COLOR PALETTE: background #051C2C (deep navy), main #FFFFFF, accent #B5985A (warm gold). Structured grids, data-first design, authority and gravitas.`,
  },
  notion: {
    name: "notion",
    prompt: `Notion aesthetic. STRICT COLOR PALETTE: background #FFFFFF, main #37352F, accent #EB5757. Soft, neutral, excellent readability. Thin borders, monospaced accents, minimal decorations.`,
  },
  figma: {
    name: "figma",
    prompt: `Figma brand aesthetic. STRICT COLOR PALETTE: background #1E1E1E (dark), main #FFFFFF, accents #A259FF (purple), #1ABCFE (teal), #0ACF83 (green), #FF7262 (coral). Modern, creative, geometric.`,
  },
  canva: {
    name: "canva",
    prompt: `Canva pastel aesthetic. STRICT COLOR PALETTE: background #FAFAFA, main #2C2C2C, accent #7B61FF (purple), #00C4CC (teal). Pastel gradients, friendly rounded shapes, pop and accessible.`,
  },
  netflix: {
    name: "netflix",
    prompt: `Netflix dark aesthetic. STRICT COLOR PALETTE: background #141414 (near-black), main #FFFFFF, accent #E50914 (Netflix red). Dramatic, cinematic, bold sans-serif, high contrast.`,
  },
  nike: {
    name: "nike",
    prompt: `Nike brand aesthetic. STRICT COLOR PALETTE: background #FFFFFF, main #111111, accent #FF6B00 (neon orange). Black-and-white with neon accent, extra-bold condensed type, energetic.`,
  },
  muji: {
    name: "muji",
    prompt: `MUJI aesthetic. STRICT COLOR PALETTE: background #F5F0EB (warm beige), main #3C3C3C, accent #8B7355 (natural brown). Extreme simplicity, natural warmth, quiet elegance, serif hints.`,
  },
  premium: {
    name: "premium",
    prompt: `Japanese premium seminar aesthetic. STRICT COLOR PALETTE: background #0D1B3E (deep navy), main #FFFFFF, accent #C9A84C (warm gold). Ornate Art Deco corner filigree in gold, hexagonal lattice background pattern at 5% opacity, gold horizontal divider lines, gold circle number badges, white panel cards with gold top-accent bar, flat line-art icons in gold. Bold white title, gold accent elements, luxury high-end feel.`,
  },
  corporate: {
    name: "corporate",
    prompt: `Japanese corporate business-document aesthetic. STRICT COLOR PALETTE: background #FFFFFF, main #1B2A5E (dark navy), accent #2B5BA8 (medium blue), sub-bg #E8F0FC (pale blue). Structured multi-column grid, thin-border section cards, blue accent header bars, flat colorful icons, pyramid diagrams and flow charts, information-dense layout, professional and trustworthy.`,
  },
};

// ─── プリセット定義 ─────────────────────────────────────────────

const PRESETS = {
  "video-slide": { name: "video-slide", size: "16:9", constraints: ["Design for 10-20 seconds viewing time per slide", "Keep bottom 8% clear for caption area"] },
  "thumbnail": { name: "thumbnail", size: "16:9", constraints: ["Must be readable at 320px wide thumbnail size", "One big visual + minimal text"] },
  "sns-square": { name: "sns-square", size: "1:1", constraints: ["Optimized for Instagram/X square format", "Text must be legible on mobile"] },
  "sns-story": { name: "sns-story", size: "9:16", constraints: ["Vertical format for Instagram/TikTok stories", "Key content in center 70%"] },
};

const SIZE_MAP = {
  "16:9": "16:9 (1920x1080px)",
  "1:1": "1:1 (1080x1080px)",
  "9:16": "9:16 (1080x1920px)",
};

// ─── プロンプト構築 ─────────────────────────────────────────────

const DESIGN_RULES = `=== DESIGN PHILOSOPHY ===
A good image causes an INTENDED CHANGE in the viewer's mind with MINIMUM COGNITIVE LOAD.
1. PURPOSE-DRIVEN: Every element exists to change the viewer.
2. INTENTIONALLY DESIGNED: Every element is a deliberate choice.
3. MINIMUM COGNITIVE LOAD: The viewer must "get it" without thinking.

=== ABSOLUTE RULES ===
- TEXT ACCURACY IS #1 PRIORITY. Copy every character EXACTLY from "TEXT TO RENDER".
- NEVER use emoji anywhere on the image.
- Render ONLY the listed text. Do NOT add extra labels, taglines, slogans, or invented text.
- Do NOT invent or add ANY text not listed in "TEXT TO RENDER" — no captions, no decorative words, no AI-generated additions.
- ALL Japanese text must be perfectly legible. Render each Japanese character with extreme precision.
- For long Japanese titles: render character-by-character, do NOT skip, merge, or substitute any character.

=== ILLUSTRATION STYLE ===
- FLAT DESIGN + LINE ART ONLY. NO 3D, isometric, glossy, or realistic rendering.
- Think: Notion line icons, Apple SF Symbols.
- For DEMO slides: show a clean flat illustration of a laptop or monitor screen with a simple UI diagram inside. Do NOT render actual video players, screenshots, or recursive slide content.

=== TYPOGRAPHY ===
- CLEAN TYPOGRAPHY ONLY. No outlines, shadows, strokes, or 3D effects.
- Title: extra-bold, large, high contrast. Subtitle: regular weight, smaller, muted.

=== LAYOUT ===
- Strict GRID system. Generous margins (10%+ each side).
- ONE clear focal point per image. Maximum 3 visual layers.
- Whitespace is a design element — at least 40% empty space.
- For 16:9: arrange sequential items HORIZONTALLY. NEVER stack 3+ items vertically.

=== VISUAL DISCIPLINE ===
- NO decorative gradients, curves, swooshes, or wave shapes.
- NO rounded rectangle cards, pill badges, button shapes, or card grids with shadows.
- Think "Apple keynote slide" — minimal, grid-aligned, breathable.`;

// スタイル指示アノテーションを除去（例:「レベル名（白太字）」→「レベル名」）
// plan.jsがotherにスタイルヒントを混入した場合のフェイルセーフ
function stripStyleAnnotations(text) {
  return text
    .replace(/[（(][^）)]*(?:太字|細字|シルバー|ゴールド|右寄せ|左寄せ|中央|センター|イタリック|bold|italic|color|font|weight)[^）)]*[）)]/gi, "")
    .trim();
}

function buildPrompt(imageSpec, style, preset, styleDescription) {
  const size = SIZE_MAP[preset?.size || "16:9"] || "16:9 (1920x1080px)";
  const purpose = imageSpec.purpose || "";
  const main = stripStyleAnnotations(imageSpec.text?.main || "");
  const sub = stripStyleAnnotations(imageSpec.text?.sub || "");
  const other = (imageSpec.text?.other || []).map(stripStyleAnnotations);

  let textSection = `Main title: ${main}`;
  if (sub) textSection += `\nSubtitle: ${sub}`;
  if (other.length > 0) textSection += `\nOther elements (arrange HORIZONTALLY): ${other.map((t, i) => `${i + 1}. ${t}`).join("  |  ")}`;

  let styleSection = style ? `Base concept (${style.name}): ${style.prompt}` : "";
  if (styleDescription) styleSection += `\nUnified style: ${styleDescription}`;

  let presetSection = "";
  if (preset?.constraints?.length) {
    presetSection = `\n=== PRESET (${preset.name}) ===\n${preset.constraints.map(c => `- ${c}`).join("\n")}`;
  }

  return `Generate a single image (${size}).

${DESIGN_RULES}

=== PURPOSE ===
${purpose}

=== TEXT TO RENDER (render ONLY these exact strings) ===
${textSection}

=== VISUAL STYLE ===
${styleSection}
Design as a professional INFOGRAPHIC. Use diagrams, flow arrows, icons, charts where appropriate.
Visual elements should occupy 40-50% of the image.
${presetSection}`;
}

// ─── メイン処理 ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let designPath = null;
  let outDir = null;
  let dryRun = false;
  let onlyIndex = null; // --index 10 で10枚目だけ生成（1始まり）

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--design" || args[i] === "-d") { designPath = args[++i]; }
    else if (args[i] === "--out" || args[i] === "-o") { outDir = args[++i]; }
    else if (args[i] === "--dry-run") { dryRun = true; }
    else if (args[i] === "--index") { onlyIndex = parseInt(args[++i], 10); }
    else if (args[i] === "--list-styles") {
      console.log("Available styles:");
      for (const [name, s] of Object.entries(STYLES)) {
        console.log(`  ${name.padEnd(12)} ${s.prompt.split(".")[0]}`);
      }
      return;
    }
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: node slides/engine/generate.js --design <json> --out <dir> [--dry-run]`);
      return;
    }
  }

  if (!designPath || !outDir) {
    console.error("Error: --design and --out are required");
    process.exit(1);
  }

  // 相対パスはprojectRoot基準で解決（worktree内からの実行でもファイルが正しい場所に出力される）
  if (!path.isAbsolute(designPath)) designPath = path.resolve(projectRoot, designPath);
  if (!path.isAbsolute(outDir)) outDir = path.resolve(projectRoot, outDir);

  const design = JSON.parse(fs.readFileSync(designPath, "utf-8"));
  const style = STYLES[design.style_base] || null;
  const preset = PRESETS[design.preset] || PRESETS["video-slide"];

  const slidesDir = path.join(outDir, "slides");
  fs.mkdirSync(slidesDir, { recursive: true });

  let jobs = design.images.map((spec, i) => ({
    prompt: buildPrompt(spec, style, preset, design.style_description),
    outputPath: path.join(slidesDir, `slide-${i + 1}.png`),
  }));

  if (onlyIndex !== null) {
    jobs = jobs.filter((_, i) => i + 1 === onlyIndex);
    if (jobs.length === 0) {
      console.error(`Error: --index ${onlyIndex} が範囲外です（1〜${design.images.length}）`);
      process.exit(1);
    }
  }

  console.log(`Images to generate: ${jobs.length}`);
  console.log(`Style: ${style?.name || "none"}`);
  console.log(`Preset: ${preset.name}`);

  if (dryRun) {
    console.log("\n--- DRY RUN ---\n");
    jobs.forEach((job, i) => {
      console.log(`=== Slide ${i + 1} ===`);
      console.log(`Output: ${job.outputPath}`);
      console.log(`Prompt (500 chars):\n${job.prompt.slice(0, 500)}...\n`);
    });
    return;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error("Error: GOOGLE_AI_API_KEY is not set.");
    console.error("Get one at: https://aistudio.google.com/apikey");
    process.exit(1);
  }

  let GoogleGenerativeAI;
  try {
    const mod = await import("@google/generative-ai");
    GoogleGenerativeAI = mod.GoogleGenerativeAI;
  } catch {
    console.error("Error: @google/generative-ai not found. Run: npm install @google/generative-ai");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // プライマリ: 高品質モデル / フォールバック: 安定モデル
  const PRIMARY_MODEL   = "gemini-3-pro-image-preview";
  const FALLBACK_MODEL  = "gemini-3.1-flash-image-preview";

  const makeModel = (name) => genAI.getGenerativeModel({
    model: name,
    generationConfig: { responseModalities: ["Text", "Image"] },
  });

  let success = 0;
  let usingFallback = false; // 一度フォールバックに切り替えたら以降もフォールバック

  for (let i = 0; i < jobs.length; i++) {
    const { prompt, outputPath } = jobs[i];
    const label = design.images[i]?.text?.main || `Slide ${i + 1}`;

    // 503リトライ → それでも駄目ならフォールバックモデルで1回試みる
    const MAX_RETRY = 3;
    let lastError = null;
    let saved = false;

    const modelsToTry = usingFallback
      ? [FALLBACK_MODEL]
      : [PRIMARY_MODEL, FALLBACK_MODEL];

    for (const modelName of modelsToTry) {
      const model = makeModel(modelName);
      for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        try {
          const TIMEOUT_MS = 180000; // 180秒でタイムアウト（高品質モデルは生成に時間がかかる）
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout (60s)")), TIMEOUT_MS)
          );
          const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
          const response = await result.response;
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const buffer = Buffer.from(part.inlineData.data, "base64");
              fs.writeFileSync(outputPath, buffer);
              saved = true;
              break;
            }
          }
          if (saved) break;
          console.log(`[${i + 1}/${jobs.length}] 試行${attempt}(${modelName}): 画像なし — ${label}`);
        } catch (error) {
          lastError = error;
          const is503 = error.message?.includes("503") || error.message?.includes("high demand");
          if (is503 && attempt < MAX_RETRY) {
            const wait = attempt * 15000;
            console.log(`[${i + 1}/${jobs.length}] 試行${attempt}(${modelName}): 高負荷503 — ${wait / 1000}秒待ってリトライ...`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            break;
          }
        }
      }
      if (saved) break;
      if (modelName === PRIMARY_MODEL && !usingFallback) {
        console.log(`[${i + 1}/${jobs.length}] プライマリ失敗 → フォールバックモデルに切替 (${FALLBACK_MODEL})`);
        usingFallback = true;
      }
    }

    if (saved) {
      // 生成後に 1920×1080 へ強制リサイズ（Gemini が異なるサイズで出力する場合の統一処理）
      try {
        const resized = await sharp(outputPath)
          .resize(1920, 1080, { fit: "cover", position: "center" })
          .png()
          .toBuffer();
        fs.writeFileSync(outputPath, resized);
      } catch (resizeErr) {
        console.warn(`[${i + 1}/${jobs.length}] リサイズ失敗（スキップ）: ${resizeErr.message}`);
      }
      success++;
      console.log(`[${i + 1}/${jobs.length}] OK — ${label}`);
    } else {
      console.log(`[${i + 1}/${jobs.length}] FAILED — ${label}: ${lastError?.message || "no image"}`);
    }

    if (i < jobs.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\nDone: ${success}/${jobs.length} generated`);
  console.log(`Output: ${slidesDir}`);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
