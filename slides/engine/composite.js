#!/usr/bin/env node

/**
 * 顔写真合成スクリプト
 * 生成済みスライドPNGの円形プレースホルダーに顔写真を合成する
 *
 * Usage:
 *   node slides/engine/composite.js --slide slides/output/slides/slide-10.png --photo mikami.jpg --out slides/output/slides/slide-10-final.png
 *   node slides/engine/composite.js --slide slides/output/slides/slide-11.png --photo sato.jpg --out slides/output/slides/slide-11-final.png
 *
 * オプション:
 *   --slide   元のスライドPNG（必須）
 *   --photo   貼り付ける顔写真（必須）
 *   --out     出力先（省略時は元ファイルに _final を付けて保存）
 *   --x       円の中心X座標（省略時は自動検出）
 *   --y       円の中心Y座標（省略時は自動検出）
 *   --size    円の直径px（省略時は自動検出）
 *   --detect  プレースホルダー位置を検出してログ出力するだけ（確認用）
 */

import fs from "node:fs";
import path from "node:path";

// ─── 引数パース ─────────────────────────────────────────────

const args = process.argv.slice(2);
let slidePath = null;
let photoPath = null;
let outPath = null;
let manualX = null;
let manualY = null;
let manualSize = null;
let detectOnly = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--slide")   { slidePath  = args[++i]; }
  else if (args[i] === "--photo")   { photoPath  = args[++i]; }
  else if (args[i] === "--out")     { outPath    = args[++i]; }
  else if (args[i] === "--x")       { manualX    = parseInt(args[++i]); }
  else if (args[i] === "--y")       { manualY    = parseInt(args[++i]); }
  else if (args[i] === "--size")    { manualSize = parseInt(args[++i]); }
  else if (args[i] === "--detect")  { detectOnly = true; }
  else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`Usage: node slides/engine/composite.js --slide <png> --photo <jpg/png> [--out <png>] [--x <n>] [--y <n>] [--size <n>]`);
    process.exit(0);
  }
}

if (!slidePath) { console.error("Error: --slide が必要です"); process.exit(1); }
if (!photoPath && !detectOnly) { console.error("Error: --photo が必要です（--detect モードを除く）"); process.exit(1); }
if (!fs.existsSync(slidePath)) { console.error(`Error: スライドファイルが見つかりません: ${slidePath}`); process.exit(1); }
if (photoPath && !fs.existsSync(photoPath)) { console.error(`Error: 顔写真ファイルが見つかりません: ${photoPath}`); process.exit(1); }

if (!outPath) {
  const ext = path.extname(slidePath);
  outPath = slidePath.replace(ext, `_final${ext}`);
}

// ─── sharp の動的インポート ─────────────────────────────────

let sharp;
try {
  const mod = await import("sharp");
  sharp = mod.default;
} catch {
  console.error("Error: sharp が見つかりません。次を実行してください: cd slides/engine && npm install");
  process.exit(1);
}

// ─── プレースホルダー検出 ───────────────────────────────────
//
// 戦略: スライド内の「グレー系の円形領域」を探す。
// 生成されたプレースホルダーは以下の特徴を持つ想定:
//   - 明るいグレー（R:180-220, G:180-220, B:180-220）の塊
//   - ブライトブルー（#2563EB）のボーダーに囲まれている
//   - 左1/4エリア（x < width*0.3）に存在する
//   - 上半分（y < height*0.6）に存在する
//
// 自動検出が難しい場合は --x --y --size で手動指定できる。

async function detectPlaceholder(slideSharp, width, height) {
  // 探索対象エリア: 左30% × 上60%
  const searchX = 0;
  const searchY = 0;
  const searchW = Math.floor(width * 0.30);
  const searchH = Math.floor(height * 0.60);

  const { data } = await slideSharp
    .clone()
    .extract({ left: searchX, top: searchY, width: searchW, height: searchH })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // ピクセルごとにグレー度をチェック
  const channels = 3;
  let grayPixels = [];

  for (let py = 0; py < searchH; py++) {
    for (let px = 0; px < searchW; px++) {
      const idx = (py * searchW + px) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // グレー判定: R≒G≒B かつ 150〜225の範囲
      const avg = (r + g + b) / 3;
      const diff = Math.max(Math.abs(r - avg), Math.abs(g - avg), Math.abs(b - avg));
      if (avg >= 150 && avg <= 225 && diff < 20) {
        grayPixels.push({ x: searchX + px, y: searchY + py });
      }
    }
  }

  if (grayPixels.length < 100) {
    return null; // グレー領域が少なすぎ → 検出失敗
  }

  // 重心を計算
  const sumX = grayPixels.reduce((s, p) => s + p.x, 0);
  const sumY = grayPixels.reduce((s, p) => s + p.y, 0);
  const cx = Math.round(sumX / grayPixels.length);
  const cy = Math.round(sumY / grayPixels.length);

  // 最大半径を推定（重心から最遠のグレーピクセルまでの距離）
  let maxDist = 0;
  for (const p of grayPixels) {
    const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    if (d > maxDist) maxDist = d;
  }

  const diameter = Math.round(maxDist * 2);
  return { cx, cy, diameter };
}

// ─── 円形マスク生成 ─────────────────────────────────────────

function circleMaskSvg(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>` +
    `</svg>`
  );
}

// ─── メイン処理 ─────────────────────────────────────────────

async function main() {
  const slideSharp = sharp(slidePath);
  const { width, height } = await slideSharp.metadata();

  console.log(`スライドサイズ: ${width}x${height}`);

  // 座標決定
  let cx, cy, diameter;

  if (manualX !== null && manualY !== null && manualSize !== null) {
    cx = manualX;
    cy = manualY;
    diameter = manualSize;
    console.log(`手動指定: 中心(${cx}, ${cy}) 直径${diameter}px`);
  } else {
    console.log("プレースホルダーを自動検出中...");
    const detected = await detectPlaceholder(sharp(slidePath), width, height);

    if (detected) {
      cx = detected.cx;
      cy = detected.cy;
      diameter = Math.round(detected.diameter * 0.85); // 名前テキストへの被りを防ぐため85%に縮小
      console.log(`自動検出成功: 中心(${cx}, ${cy}) 直径${diameter}px（85%縮小済み）`);
    } else {
      // 自動検出失敗時のフォールバック（1920x1080想定の概算座標）
      cx = Math.round(width * 0.125);
      cy = Math.round(height * 0.28);
      diameter = Math.round(height * 0.28);
      console.log(`自動検出失敗 → フォールバック座標を使用: 中心(${cx}, ${cy}) 直径${diameter}px`);
      console.log(`※ 位置がずれる場合は --x ${cx} --y ${cy} --size ${diameter} で手動調整してください`);
    }
  }

  if (detectOnly) {
    console.log(`\n[--detect モード] 位置を確認してから合成を実行してください:`);
    console.log(`  node slides/engine/composite.js --slide "${slidePath}" --photo <顔写真> --x ${cx} --y ${cy} --size ${diameter}`);
    return;
  }

  // 顔写真を円形にクロップ
  const mask = circleMaskSvg(diameter);
  const circlePhoto = await sharp(photoPath)
    .resize(diameter, diameter, { fit: "cover", position: "top" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  // スライドに合成
  const left = Math.round(cx - diameter / 2);
  const top  = Math.round(cy - diameter / 2);

  await sharp(slidePath)
    .composite([{
      input: circlePhoto,
      left: Math.max(0, left),
      top:  Math.max(0, top),
      blend: "over",
    }])
    .png()
    .toFile(outPath);

  console.log(`完成: ${outPath}`);
  console.log(`\n位置がずれていた場合は --x --y --size で調整してください:`);
  console.log(`  node slides/engine/composite.js --slide "${slidePath}" --photo "${photoPath}" --x <中心X> --y <中心Y> --size <直径>`);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
