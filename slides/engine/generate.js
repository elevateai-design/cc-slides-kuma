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
- Render ONLY the listed text. Do NOT add extra labels or numbers.
- ALL Japanese text must be perfectly legible.

=== ILLUSTRATION STYLE ===
- FLAT DESIGN + LINE ART ONLY. NO 3D, isometric, glossy, or realistic rendering.
- Think: Notion line icons, Apple SF Symbols.

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

function buildPrompt(imageSpec, style, preset, styleDescription) {
  const size = SIZE_MAP[preset?.size || "16:9"] || "16:9 (1920x1080px)";
  const purpose = imageSpec.purpose || "";
  const main = imageSpec.text?.main || "";
  const sub = imageSpec.text?.sub || "";
  const other = imageSpec.text?.other || [];

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
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-image-preview",
    generationConfig: { responseModalities: ["Text", "Image"] },
  });

  let success = 0;
  for (let i = 0; i < jobs.length; i++) {
    const { prompt, outputPath } = jobs[i];
    const label = design.images[i]?.text?.main || `Slide ${i + 1}`;

    // 503（高負荷）は最大3回リトライ
    const MAX_RETRY = 3;
    let lastError = null;
    let saved = false;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const result = await model.generateContent(prompt);
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
        console.log(`[${i + 1}/${jobs.length}] 試行${attempt}: 画像なし — ${label}`);
      } catch (error) {
        lastError = error;
        const is503 = error.message?.includes("503") || error.message?.includes("high demand");
        if (is503 && attempt < MAX_RETRY) {
          const wait = attempt * 15000; // 15秒 → 30秒
          console.log(`[${i + 1}/${jobs.length}] 試行${attempt}: 高負荷503 — ${wait / 1000}秒待ってリトライします...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          break;
        }
      }
    }

    if (saved) {
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
