/**
 * write-doc.js
 * Google Docs に言語化ドキュメントを書き込む
 * 見出し・太字・箇条書き・テーブル・フォントサイズ12ptを適用
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import url from 'url';
import open from 'open';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/documents'];
const DEFAULT_DOC_ID = '1te9yeD-VIW6BSktVFtYYs_TIMwuk8kpzm2ZDVVAdyAI';
const FONT_SIZE_PT = 12;

// ============================================================
// 認証
// ============================================================
async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost');

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }
  return await getNewToken(oAuth2Client);
}

async function getNewToken(oAuth2Client) {
  let serverPort;
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const qs = new url.URL(req.url, `http://localhost:${serverPort}`).searchParams;
      const code = qs.get('code');
      res.end('<h1>認証完了。このタブを閉じてください。</h1>');
      server.close();
      if (code) resolve(code); else reject(new Error('認証コード取得失敗'));
    });
    server.listen(0, async () => {
      serverPort = server.address().port;
      oAuth2Client.redirectUri = `http://localhost:${serverPort}`;
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', scope: SCOPES,
        redirect_uri: `http://localhost:${serverPort}`
      });
      console.log(`\n🔑 ブラウザで認証してください... (ポート${serverPort})`);
      await open(authUrl);
    });
    server.on('error', reject);
  });
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✅ token.json 保存済み');
  return oAuth2Client;
}

// ============================================================
// ドキュメント内容定義
// type: h1 | h2 | normal | bold | bullet | empty | table_ref
// ============================================================
const BLOCKS = [
  { type: 'h1',     text: 'cc-slides-kuma デザインシステム＆ワークフロー言語化ドキュメント' },
  { type: 'empty' },

  { type: 'h2',    text: '1. デザイン方針・コンセプト' },
  { type: 'bold',  text: '基本方針：「訴求軸 × ターゲット × スタイル × デモコンテンツ」の4変数でスライド全体を制御する' },
  { type: 'normal',text: 'スライドのデザインは「何を訴えるか（訴求軸）」「誰に向けて話すか（ターゲット）」「どう見せるか（スタイル）」「何のデモを見せるか（デモコンテンツ）」の4変数で決まるという考えのもと設計した。この4変数をbrief（入力ファイル）に持たせ、それをClaude APIが読み込んでテキスト設計に変換、さらにGemini APIが画像として具現化する2段階のAIパイプラインを構築した。' },
  { type: 'empty' },
  { type: 'bold',  text: 'スタイル設計の考え方：' },
  { type: 'normal',text: '各スタイル（manus / yellow / teal / premium / corporate の5種）は、実在するブランドや企業の視覚言語を参照している。これにより「プレミアム感」「親しみやすさ」「データ重視」など、ターゲットの感情に合わせたデザインを言語で指示できる。生成AIへの指示を「色とレイアウトの細かい数値」ではなく「ブランド参照」で行うことで、再現性と品質のバランスをとった。' },
  { type: 'empty' },
  { type: 'bold',  text: '削ったもの：' },
  { type: 'normal',text: 'フォント指定・余白の数値・グリッドシステムといった厳密なデザイントークンは持たせなかった。Gemini APIの画像生成において細かな数値指定は効果が薄く、むしろブランド参照＋感情語（「洗練された」「力強い」など）のほうが品質が安定するため。' },
  { type: 'empty' },

  { type: 'h2',    text: '2. スライドの構成・流れの設計意図' },
  { type: 'bold',  text: '全26枚の構成ロジック：問題提起 → 共感 → 解決策 → 証拠 → 価格 → CTA' },
  { type: 'normal',text: 'セールスプレゼンの王道フレームワーク「PASONA」「PREP」を参考に設計した。' },
  { type: 'empty' },
  { type: 'table_ref', id: 'TABLE_SLIDES' },
  { type: 'empty' },
  { type: 'bold',  text: '「価格を後出し」にした理由：' },
  { type: 'normal',text: '価格（198,000円）は22枚目まで出さない。先に「¥2,485,000相当」の価値を積み上げることで、価格提示時の感情的ハードルを下げる構成にした。' },
  { type: 'empty' },

  { type: 'h2',    text: '3. 使用したAI・ツール' },
  { type: 'table_ref', id: 'TABLE_TOOLS' },
  { type: 'empty' },

  { type: 'h2',    text: '4. プロンプト連鎖・エージェント構成' },
  { type: 'bold',  text: '2段階パイプライン：' },
  { type: 'normal',text: '[入力] brief-template.md' },
  { type: 'normal',text: '　↓' },
  { type: 'normal',text: '[Step 1] plan.js × Claude API' },
  { type: 'normal',text: '　→ briefの訴求軸・ターゲット・スタイル・デモコンテンツを読み込み' },
  { type: 'normal',text: '　→ 全26枚分のスライド設計（main/sub/other要素）をJSON生成' },
  { type: 'normal',text: '　→ 出力：image-design.json' },
  { type: 'normal',text: '　↓' },
  { type: 'normal',text: '[Step 2] generate.js × Gemini API' },
  { type: 'normal',text: '　→ image-design.jsonの各スライド定義を読み込み' },
  { type: 'normal',text: '　→ スタイル定義（色・レイアウト・ムード）と組み合わせてプロンプト構築' },
  { type: 'normal',text: '　→ Gemini gemini-3-pro-image-previewで1枚ずつ画像生成' },
  { type: 'normal',text: '　→ sharpで1920×1080にリサイズ・統一' },
  { type: 'normal',text: '　→ 出力：slides/output/slides/slide-N.png' },
  { type: 'empty' },
  { type: 'bold',  text: 'Claude APIへのプロンプト設計の工夫：' },
  { type: 'normal',text: 'サービス仕様（価格・講師実績・反論回答）をすべてbriefに集約し、plan.jsがそれを参照する設計にした。これにより「情報の更新→スライド再生成」が1コマンドで完結する。各スライドの役割をシステムプロンプトで定義し、役割に応じたコピーの強度を制御した。' },
  { type: 'empty' },
  { type: 'bold',  text: 'briefによる固定指示の埋め込み：' },
  { type: 'normal',text: 'plan.jsはbrief全文をClaude APIに渡すため、briefに「固定スライドテキスト」「固定スライドレイアウト」「全体ルール」のセクションを設けることで、plan.js本体を編集せずにプロンプトを制御できる設計にした。例：デモスライドのタイトル冒頭を「7日後に完成する、」で固定、Gemini安全フィルタ対策として実在固有名詞（実大学名・実メディア名）を一般表現に置換、▲などの記号は色コード（#XXXXXX）と誤認識されるため平文で表現、など。' },
  { type: 'empty' },
  { type: 'bold',  text: 'エラー耐性：' },
  { type: 'normal',text: 'Gemini APIの503エラー（モデル高需要時）に対してリトライ機構を実装。30秒待機後に最大3回再試行、それでも失敗した場合はフォールバックモデル（gemini-3.1-flash-image-preview）に切り替える。' },
  { type: 'empty' },

  { type: 'h2',    text: '5. こだわったポイント・難しかった部分' },
  { type: 'bold',  text: 'こだわった点：' },
  { type: 'bullet',text: '再現性の担保：同じbriefを渡せば同じ構成のスライドが何度でも生成される。手作業の固定パーツをゼロにした。' },
  { type: 'bullet',text: '部分再生成の実装：--indexオプションで「3枚目だけ」「5,8,10-12枚目」など柔軟な範囲指定で再生成できる。全枚数の再生成（5〜10分）を待たずに調整できる。' },
  { type: 'bullet',text: 'スタイル定義の言語化：「manus = 薄ブルー×ネイビー、洗練されたビジネス感」のように、AIが解釈できる言語でスタイルを定義した。ブランド名参照が最も効果的と判断。' },
  { type: 'bullet',text: 'ヒアリングフローの堅牢化：brief-template.mdの動的項目をプレースホルダー（<ヒアリングで入力>）化し、plan.js実行前にgrepで未入力を検出する仕組みを導入。さらに更新内容を5項目（訴求軸・ターゲット・スタイル・デモ①②）まとめてユーザーに目視確認させる確認ステップを必須化。「うっかり古い値で生成」を構造的に防止した。' },
  { type: 'empty' },
  { type: 'bold',  text: '難しかった部分：' },
  { type: 'bullet',text: 'Gemini APIの文字化け問題：低品質モデル（gemini-2.0-flash-preview-image-generation）使用時に日本語テキストが崩れる問題が発生。高品質モデル（gemini-3-pro-image-preview）への切り替えで解消。' },
  { type: 'bullet',text: 'APIの高負荷による503エラー：gemini-3-pro-image-previewはプレビューモデルのため需要集中時に503が頻発。リトライ機構の実装と生成タイミング（米国夜間＝日本時間午前）での実行で対処。' },
  { type: 'bullet',text: 'テキスト設計とビジュアルのギャップ：Claudeが設計したテキスト量とGeminiが生成するレイアウトが合わない場合がある。スライドあたりの文字数に上限を設けるプロンプト設計で緩和。' },
  { type: 'bullet',text: 'デザインスタイル指示の重さによるタイムアウト：当初は各スタイルのstyle_descriptionに1,100〜1,400文字の詳細指示（装飾・コーナー演出・チャート仕様・テーブル仕様など）を書いていたが、夜間のGemini高負荷時に頻繁にタイムアウトが発生。デザインスタイルの詳細指示文の分量を必要最低限の指示に簡素化・合理化（背景色・コアパレット・タイポグラフィ・カード基本・絵文字禁止のみ）し、各スタイル380〜450文字（約3分の1）に圧縮することで、生成安定性を大きく改善した。' },
  { type: 'bullet',text: '実在固有名詞によるGemini安全フィルタ反応：「東京大学」「Abema・朝日新聞」などの実名がGemini側の安全フィルタに反応し、スライド生成が無音で失敗するケースが発生。brief側で「最難関大学」「TV・新聞・広告で多数露出」など一般表現に置換することで解消。' },
  { type: 'bullet',text: '記号の色コード誤認識：「▲50,000円オフ」などの三角記号がGeminiに「#374151」のような色コードとして誤認識され、「#374151オフ」と崩れた文字列が出力された。「50,000円割引」のように平文で書くルールに統一して解消。' },
  { type: 'empty' },

  { type: 'h2',    text: '6. 自己評価（良い点・改善余地）' },
  { type: 'bold',  text: '良い点：' },
  { type: 'bullet',text: 'システムとして完結している：brief 1ファイルを変えるだけで、訴求軸・ターゲット・スタイル・デモコンテンツの異なる複数バリエーションを生成できる。評価タスクの「再現性」要件を満たしている。' },
  { type: 'bullet',text: '実用的な構成：26枚の構成はセールスプレゼンのフレームワークに沿っており、「そのまま販売現場で使える」レベルを意識した。' },
  { type: 'bullet',text: '保守性：plan.jsとgenerate.jsを分離したことで、「テキストだけ直したい」「画像だけ再生成したい」が独立して実行できる。' },
  { type: 'empty' },
  { type: 'bold',  text: '改善余地：' },
  { type: 'bullet',text: 'フォント品質：Geminiの画像生成では日本語フォントの選択が制御できない。pptxやSlidevへの出力に切り替えることで、フォントの完全制御が可能になる。' },
  { type: 'bullet',text: '生成速度：26枚フルで5〜10分かかる。並列生成（Promise.all）の実装で高速化できるが、API rate limitとのトレードオフになる。' },
  { type: 'bullet',text: 'デモスライド（8・9番）の完結性：デモ内容はヒアリングで動的入力できる仕組みを実装済み（タイトル冒頭「7日後に完成する、〇〇」で固定）。ただしスライド単体は依然ライブデモへの橋渡し用の静止画。スライド単体でデモの価値を伝えるには、GIF埋め込みやスクリーンショット合成の仕組みが必要。' },
];

const TABLES = {
  TABLE_SLIDES: {
    headers: ['フェーズ', 'スライド番号', '目的'],
    rows: [
      ['掴み',           '01',      'キャッチコピーで世界観を提示'],
      ['問題提起',        '02〜05', '現状の痛みを数字で可視化'],
      ['解決策の提示',    '06〜07', 'Claude Codeと先行者利益を説明'],
      ['実証（デモ）',    '08〜09', '「本当に動く」を見せる導入ページ'],
      ['信頼構築',        '10〜13', '講師実績・1期生の成果'],
      ['商品説明',        '14〜22', '内容・特典・価格を段階的に開示'],
      ['反論処理',        '23〜24', 'FAQで心理的障壁を除去'],
      ['決断促進',        '25〜26', 'ROI・CTAで行動に導く'],
    ],
  },
  TABLE_TOOLS: {
    headers: ['役割', 'ツール'],
    rows: [
      ['テキスト設計（構成・コピー生成）', 'Claude API（claude-opus-4-5）'],
      ['スライド画像生成',                'Gemini API（gemini-3-pro-image-preview / gemini-3.1-flash-image-preview）'],
      ['画像リサイズ・統一',              'sharp（Node.js）'],
      ['パイプライン制御',                'Node.js（plan.js / generate.js）'],
      ['バージョン管理',                  'GitHub'],
      ['開発支援',                        'Claude Code'],
    ],
  },
};

// ============================================================
// STEP 1: テキスト全挿入 + スタイル適用（1回のbatchUpdate）
// ============================================================
async function writeTextAndStyles(docs, docId) {
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = doc.data.body.content.at(-1).endIndex - 1;
  const requests = [];

  // 全削除
  if (endIndex > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
  }

  // テキスト構築 & インデックス記録
  let fullText = '';
  const positions = [];
  let idx = 1;

  for (const block of BLOCKS) {
    const line = block.type === 'table_ref'
      ? `[TABLE:${block.id}]\n`
      : (block.text ?? '') + '\n';
    positions.push({ ...block, startIndex: idx, endIndex: idx + line.length });
    fullText += line;
    idx += line.length;
  }

  requests.push({ insertText: { location: { index: 1 }, text: fullText } });

  // スタイルリクエストを追加
  for (const pos of positions) {
    const { type, startIndex, endIndex } = pos;
    const textEnd = endIndex - 1; // \n を除いたテキスト末尾

    // 見出し
    if (type === 'h1') {
      requests.push({ updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType'
      }});
    } else if (type === 'h2') {
      requests.push({ updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: { namedStyleType: 'HEADING_2' }, fields: 'namedStyleType'
      }});
    }

    // 箇条書き
    if (type === 'bullet') {
      requests.push({ createParagraphBullets: {
        range: { startIndex, endIndex },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
      }});
    }

    // 太字
    if (type === 'bold') {
      requests.push({ updateTextStyle: {
        range: { startIndex, endIndex: textEnd },
        textStyle: { bold: true }, fields: 'bold'
      }});
    }

    // フォントサイズ（見出し・空行・テーブルプレースホルダー以外）
    if (['normal', 'bold', 'bullet'].includes(type) && textEnd > startIndex) {
      requests.push({ updateTextStyle: {
        range: { startIndex, endIndex: textEnd },
        textStyle: { fontSize: { magnitude: FONT_SIZE_PT, unit: 'PT' } },
        fields: 'fontSize'
      }});
    }
  }

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  console.log('✅ テキスト・スタイル適用完了');
}

// ============================================================
// STEP 2: テーブルプレースホルダーを実テーブルに差し替え
// ============================================================
async function replaceWithTable(docs, docId, tableId, tableData) {
  const { headers, rows } = tableData;
  const placeholder = `[TABLE:${tableId}]`;
  const totalRows = rows.length + 1;
  const totalCols = headers.length;

  // プレースホルダーの位置を取得
  const doc = await docs.documents.get({ documentId: docId });
  let phStart = -1, phEnd = -1;
  for (const el of doc.data.body.content) {
    if (!el.paragraph) continue;
    const text = el.paragraph.elements.map(e => e.textRun?.content ?? '').join('');
    if (text.includes(placeholder)) {
      phStart = el.startIndex;
      phEnd   = el.endIndex;
      break;
    }
  }
  if (phStart === -1) throw new Error(`Placeholder not found: ${placeholder}`);

  // プレースホルダーテキストを消してテーブルを挿入
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [
    { deleteContentRange: { range: { startIndex: phStart, endIndex: phEnd - 1 } } },
    { insertTable: { rows: totalRows, columns: totalCols, location: { index: phStart } } },
  ]}});

  // テーブルの位置を再取得
  const doc2 = await docs.documents.get({ documentId: docId });
  let tableEl = null;
  for (const el of doc2.data.body.content) {
    if (el.table && el.startIndex >= phStart - 1 && el.startIndex <= phStart + 5) {
      tableEl = el; break;
    }
  }
  // 見つからなければ最初のテーブルを使う
  if (!tableEl) {
    for (const el of doc2.data.body.content) {
      if (el.table) { tableEl = el; break; }
    }
  }
  if (!tableEl) throw new Error(`Table not found after inserting ${tableId}`);

  // セルにテキストを逆順で挿入（インデックスがずれないよう末尾から）
  const allRows = [headers, ...rows];
  const insertReqs = [];
  for (let r = allRows.length - 1; r >= 0; r--) {
    for (let c = allRows[r].length - 1; c >= 0; c--) {
      const cell = tableEl.table.tableRows[r].tableCells[c];
      const cellIdx = cell.content[0].startIndex;
      if (allRows[r][c]) {
        insertReqs.push({ insertText: { location: { index: cellIdx }, text: allRows[r][c] } });
      }
    }
  }
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: insertReqs } });

  // ヘッダー行を太字に
  const doc3 = await docs.documents.get({ documentId: docId });
  let tableEl2 = null;
  for (const el of doc3.data.body.content) {
    if (el.table && el.startIndex >= phStart - 1 && el.startIndex <= phStart + 10) {
      tableEl2 = el; break;
    }
  }
  if (tableEl2) {
    const boldReqs = [];
    for (const cell of tableEl2.table.tableRows[0].tableCells) {
      for (const contentEl of cell.content) {
        for (const tr of contentEl.paragraph?.elements ?? []) {
          if (tr.textRun?.content?.trim()) {
            boldReqs.push({ updateTextStyle: {
              range: { startIndex: tr.startIndex, endIndex: tr.endIndex - 1 },
              textStyle: { bold: true }, fields: 'bold'
            }});
          }
        }
      }
    }
    if (boldReqs.length) {
      await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: boldReqs } });
    }
  }

  console.log(`✅ テーブル ${tableId} 挿入完了`);
}

// ============================================================
// メイン
// ============================================================
const args = process.argv.slice(2);
const docIdx = args.indexOf('--doc');
const docId = docIdx !== -1 ? args[docIdx + 1] : DEFAULT_DOC_ID;

const auth = await authorize();
const docs = google.docs({ version: 'v1', auth });

await writeTextAndStyles(docs, docId);

// テーブルをドキュメント順に置換（TABLE_SLIDES → TABLE_TOOLS）
for (const tableId of ['TABLE_SLIDES', 'TABLE_TOOLS']) {
  await replaceWithTable(docs, docId, tableId, TABLES[tableId]);
}

console.log('\n✅ 完了');
console.log(`   https://docs.google.com/document/d/${docId}/edit`);
