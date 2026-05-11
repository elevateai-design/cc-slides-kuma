#!/usr/bin/env node

/**
 * run.js - スライド自動生成 司令塔
 * brief.md → image-design.json → PNG生成 → 顔写真合成 を一気通貫で実行
 *
 * Usage:
 *   node slides/engine/run.js                          # brief.md がなければQ&Aで作成
 *   node slides/engine/run.js --brief input/brief-template.md
 *   node slides/engine/run.js --brief input/brief.md --out slides/output
 *   node slides/engine/run.js --plan-only              # JSON生成のみ（画像生成しない）
 *   node slides/engine/run.js --generate-only          # 既存JSONから画像生成のみ
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";

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

// ─── ユーティリティ ──────────────────────────────────────────

function question(rl, q) {
  return new Promise(resolve => rl.question(q, resolve));
}

async function runScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      stdio: "inherit",
      cwd: projectRoot,
    });
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} が終了コード ${code} で失敗しました`));
    });
  });
}

// ─── Q&A モード：brief.md を対話形式で作成 ─────────────────

async function createBriefInteractive(outPath) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("\n=== サービス仕様書を作成します ===");
  console.log("（Enterのみでスキップできる項目があります）\n");

  const q = (text) => question(rl, text);
  const qMulti = async (text) => {
    console.log(text + "（空行で入力終了）");
    const lines = [];
    while (true) {
      const line = await q("  > ");
      if (!line.trim()) break;
      lines.push(line.trim());
    }
    return lines;
  };

  // 基本情報
  const productName    = await q("商品・サービス名: ");
  const catchcopy      = await q("キャッチコピー（表紙の主役・1行）: ");
  const seminarName    = await q("セミナー名（表紙サブタイトル）: ");
  const organizer      = await q("主催（会社名等）: ");

  // ターゲット
  const target         = await q("\nターゲット（一言で・例: 32歳会社員、副業未経験）: ");
  console.log("\nターゲットの悩みを3つ入力してください");
  const pains = [];
  for (let i = 1; i <= 3; i++) {
    pains.push(await q(`  悩み${i}: `));
  }
  console.log("\n問題提起に使う数字・事実（例: 実質賃金マイナス傾向）");
  const externalPains  = await qMulti("");

  // 価格
  const priceExTax     = await q("\n価格（税抜・円）: ");
  const priceInTax     = await q("価格（税込・円）: ");
  const priceTransfer  = await q("銀行振込一括（省略可）: ");
  const priceInstall   = await q("分割（省略可・例: 月々7,532円〜）: ");
  const totalValue     = await q("価値総額相当（例: 2,485,000円）: ");
  const dailyCost      = await q("1日あたりコスト（省略可・例: 251円）: ");
  const roiDesc        = await q("回収目安（省略可・例: 10万円案件2件で全額回収）: ");

  // 講師
  const instructorCount = parseInt(await q("\n講師は何人いますか？: ")) || 1;
  const instructors = [];
  for (let i = 1; i <= instructorCount; i++) {
    console.log(`\n--- 講師${i} ---`);
    const name   = await q("名前: ");
    const title  = await q("肩書き: ");
    const photo  = await q("顔写真パス（省略可・例: input/photos/mikami.jpg）: ");
    const achs   = await qMulti("実績（箇条書き）");
    instructors.push({ name, title, photo, achievements: achs });
  }

  // 商品構成
  const contentCount = parseInt(await q("\n商品の主要コンテンツは何個ありますか？: ")) || 3;
  const contents = [];
  for (let i = 1; i <= contentCount; i++) {
    console.log(`\n--- コンテンツ${i} ---`);
    const name   = await q("名称: ");
    const desc   = await q("説明（1行）: ");
    const value  = await q("価値（例: 349,000円相当）: ");
    const detail = await q("詳細・特記事項（省略可）: ");
    contents.push({ name, desc, value, detail });
  }

  // 特典
  const bonusCount = parseInt(await q("\n特典は何個ありますか？（0でスキップ）: ")) || 0;
  const bonuses = [];
  for (let i = 1; i <= bonusCount; i++) {
    console.log(`\n--- 特典${i} ---`);
    const name   = await q("名称: ");
    const value  = await q("価値（例: 50,000円相当）: ");
    const detail = await q("詳細: ");
    bonuses.push({ name, value, detail });
  }

  // デモ・差別化
  const demos      = await qMulti("\nデモできる機能（省略可）");
  const diffPoint  = await q("競合との差別化ポイント（1〜2行）: ");
  const flow       = await qMulti("受講フロー（例: 購入→コミュニティ参加）");
  const graduates  = await qMulti("1期生・卒業生の実績（省略可）");

  // スタイル
  console.log("\nスタイルを選んでください:");
  console.log("  manus / stripe / apple / google / mckinsey / notion / figma / canva / netflix / nike / muji");
  const style = (await q("スタイル [manus]: ")) || "manus";

  rl.close();

  // ─── brief.md を生成 ─────────────────────────────────────────

  const lines = [
    "# サービス仕様書", "",
    "## 商品名", productName, "",
    "## キャッチコピー（1行・スライド表紙の主役になる）", catchcopy, "",
    "## セミナー名（表紙サブタイトル）", seminarName, "",
    "## 主催", organizer, "",
    "---", "",
    "## ターゲット", target, "",
    "## ターゲットの悩み（3つ）",
    ...pains.map((p, i) => `${i + 1}. ${p}`), "",
    "## ターゲットの外部的な痛み（問題提起に使う数字・事実）",
    ...externalPains.map(p => `- ${p}`), "",
    "---", "",
    "## 価格",
    `- 税抜: ${priceExTax}`,
    priceInTax     ? `- 税込: ${priceInTax}` : "",
    priceTransfer  ? `- 銀行振込一括: ${priceTransfer}` : "",
    priceInstall   ? `- 分割: ${priceInstall}` : "",
    "",
    "## 価値総額相当", totalValue, "",
    "## ROI",
    dailyCost ? `- 1日あたりのコスト: ${dailyCost}` : "",
    roiDesc   ? `- 回収目安: ${roiDesc}` : "",
    "",
    "---", "",
    "## 講師", "",
  ];

  instructors.forEach((ins, i) => {
    lines.push(`### 講師${i + 1}`, `名前: ${ins.name}`, `肩書き: ${ins.title}`);
    if (ins.photo) lines.push(`顔写真: ${ins.photo}`);
    lines.push("実績:", ...ins.achievements.map(a => `- ${a}`), "");
  });

  lines.push("---", "", "## 商品構成", "");
  contents.forEach((c, i) => {
    lines.push(
      `### コンテンツ${i + 1}`,
      `名称: ${c.name}`, `説明: ${c.desc}`, `価値: ${c.value}`,
      c.detail ? `詳細: ${c.detail}` : "", ""
    );
  });

  if (bonuses.length > 0) {
    lines.push("## 特典", "");
    bonuses.forEach((b, i) => {
      lines.push(`### 特典${i + 1}`, `名称: ${b.name}`, `価値: ${b.value}`, `詳細: ${b.detail}`, "");
    });
  }

  if (demos.length > 0) {
    lines.push("## デモコンテンツ", ...demos.map(d => `- ${d}`), "");
  }

  if (flow.length > 0) {
    lines.push("## 受講フロー", ...flow.map((f, i) => `${i + 1}. ${f}`), "");
  }

  lines.push("## 競合との差別化", diffPoint, "");

  if (graduates.length > 0) {
    lines.push("## 1期生の実績例", ...graduates.map(g => `- ${g}`), "");
  }

  lines.push("## スタイル", style, "");

  const content = lines.filter(l => l !== undefined && l !== null).join("\n");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  console.log(`\n仕様書を保存しました: ${outPath}`);
  return outPath;
}

// ─── メイン処理 ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let briefPath = null;
  let outDir = path.join(projectRoot, "slides", "output");
  let planOnly = false;
  let generateOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--brief" || args[i] === "-b") { briefPath = args[++i]; }
    else if (args[i] === "--out" || args[i] === "-o") { outDir = args[++i]; }
    else if (args[i] === "--plan-only") { planOnly = true; }
    else if (args[i] === "--generate-only") { generateOnly = true; }
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log([
        "Usage:",
        "  node slides/engine/run.js                      # Q&Aでbrief作成→全自動実行",
        "  node slides/engine/run.js --brief input/brief-template.md",
        "  node slides/engine/run.js --plan-only          # JSON生成のみ",
        "  node slides/engine/run.js --generate-only      # 既存JSONから画像生成のみ",
      ].join("\n"));
      return;
    }
  }

  const designPath = path.join(projectRoot, "slides", "image-design.json");
  const engineDir  = path.join(projectRoot, "slides", "engine");

  // ─── generate-only モード ────────────────────────────────────

  if (generateOnly) {
    if (!fs.existsSync(designPath)) {
      console.error("Error: slides/image-design.json が見つかりません。先に --brief で生成してください");
      process.exit(1);
    }
    console.log("=== 画像生成 ===");
    await runScript(path.join(engineDir, "generate.js"), ["--design", designPath, "--out", outDir]);
    await runComposite(designPath, outDir, null);
    console.log("\n完了。");
    return;
  }

  // ─── brief の準備 ────────────────────────────────────────────

  if (!generateOnly) {
    if (briefPath && fs.existsSync(briefPath)) {
      console.log(`仕様書を読み込みました: ${briefPath}`);
    } else if (briefPath && !fs.existsSync(briefPath)) {
      console.error(`Error: ファイルが見つかりません: ${briefPath}`);
      process.exit(1);
    } else {
      // brief がない → Q&A で作成
      const defaultBriefPath = path.join(projectRoot, "input", "brief.md");
      if (fs.existsSync(defaultBriefPath)) {
        console.log(`既存の仕様書を使用: ${defaultBriefPath}`);
        briefPath = defaultBriefPath;
      } else {
        briefPath = await createBriefInteractive(defaultBriefPath);
      }
    }
  }

  // ─── Stage 1: plan.js → image-design.json ───────────────────

  if (!generateOnly) {
    console.log("\n=== Stage 1: スライド設計 ===");
    await runScript(path.join(engineDir, "plan.js"), ["--brief", briefPath, "--out", designPath]);
  }

  if (planOnly) {
    console.log("\n--plan-only モード: ここで終了します");
    console.log(`設計ファイル: ${designPath}`);
    console.log("確認後、以下で画像生成できます:");
    console.log("  node slides/engine/run.js --generate-only");
    return;
  }

  // ─── Stage 2: generate.js → PNG ─────────────────────────────

  console.log("\n=== Stage 2: 画像生成 ===");
  await runScript(path.join(engineDir, "generate.js"), ["--design", designPath, "--out", outDir]);

  // ─── Stage 3: composite.js → 顔写真合成 ─────────────────────

  await runComposite(designPath, outDir, briefPath);

  // ─── 完了 ────────────────────────────────────────────────────

  console.log("\n================================");
  console.log("生成完了。");
  console.log(`出力フォルダ: ${path.join(outDir, "slides")}`);
  console.log("================================");

  // フォルダを開く（Windows）
  try {
    const { exec } = await import("node:child_process");
    exec(`explorer "${path.join(outDir, "slides").replace(/\//g, "\\")}"`);
  } catch { /* 開けなくてもOK */ }
}

// ─── 顔写真合成 ─────────────────────────────────────────────

async function runComposite(designPath, outDir, briefPath) {
  if (!fs.existsSync(designPath)) return;

  const design = JSON.parse(fs.readFileSync(designPath, "utf-8"));
  const photosJsonPath = designPath.replace(".json", "-photos.json");

  let photos = [];
  if (fs.existsSync(photosJsonPath)) {
    photos = JSON.parse(fs.readFileSync(photosJsonPath, "utf-8"));
  } else if (briefPath) {
    photos = extractPhotos(fs.readFileSync(briefPath, "utf-8"));
  }

  if (photos.length === 0) return;

  console.log("\n=== Stage 3: 顔写真合成 ===");

  const engineDir = path.join(projectRoot, "slides", "engine");
  const slidesDir = path.join(outDir, "slides");

  for (const { name, path: photoPath } of photos) {
    const absPhotoPath = path.resolve(projectRoot, photoPath);
    if (!fs.existsSync(absPhotoPath)) {
      console.log(`写真が見つかりません（スキップ）: ${absPhotoPath}`);
      continue;
    }

    // 該当スライドを探す（text.main が名前と一致）
    const slideIndex = design.images.findIndex(img => img.text?.main === name);
    if (slideIndex === -1) {
      console.log(`「${name}」に対応するスライドが見つかりませんでした（スキップ）`);
      continue;
    }

    const slideFile = path.join(slidesDir, `slide-${slideIndex + 1}.png`);
    const outFile   = path.join(slidesDir, `slide-${slideIndex + 1}-final.png`);

    if (!fs.existsSync(slideFile)) {
      console.log(`スライドファイルが見つかりません（スキップ）: ${slideFile}`);
      continue;
    }

    console.log(`合成中: ${name} → slide-${slideIndex + 1}.png`);
    await runScript(path.join(engineDir, "composite.js"), [
      "--slide", slideFile,
      "--photo", absPhotoPath,
      "--out", outFile,
    ]);
  }
}

// ─── 写真マッピング抽出 ─────────────────────────────────────

function extractPhotos(brief) {
  const photos = [];
  const blocks = brief.split(/^### 講師\d+/m).slice(1);
  for (const block of blocks) {
    const nameMatch  = block.match(/名前:\s*(.+)/);
    const photoMatch = block.match(/顔写真:\s*(.+)/);
    if (nameMatch && photoMatch) {
      photos.push({ name: nameMatch[1].trim(), path: photoMatch[1].trim() });
    }
  }
  return photos;
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
