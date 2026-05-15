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
  { type: 'h1',     text: '熊澤 佑太（cc-slides-kuma）デザインシステム＆ワークフロー言語化ドキュメント' },
  { type: 'empty' },

  // ───── 概要 ─────
  { type: 'bold',   text: '概要' },
  { type: 'normal', text: '本ドキュメントは「Claude Code 7dayブートキャンプ販売スライド自動生成システム（cc-slides-kuma）」のデザインシステム＆ワークフロー言語化資料である。brief（入力ファイル）1つを書き換えるだけで、訴求軸・ターゲット・スタイル・デモコンテンツの異なる複数バリエーションのセールススライドを、Claude API → Gemini API の2段階パイプラインで自動生成できる仕組みを構築した。本資料では、その設計判断・採用技術・苦労した点・自己評価をまとめる。' },
  { type: 'empty' },
  { type: 'bold',   text: '関連リンク' },
  { type: 'bullet', text: 'GitHub：https://github.com/elevateai-design/cc-slides-kuma' },
  { type: 'bullet', text: '生成スライド（提出用フォルダ）：別途Google Driveリンクで提出' },
  { type: 'empty' },

  { type: 'h2',    text: '1. デザイン方針・コンセプト' },
  { type: 'bold',   text: '基本コンセプト：4変数でスライド全体を制御する' },
  { type: 'normal', text: 'スライドのデザインは以下の4変数で決まると考えた。' },
  { type: 'bullet', text: '訴求軸 ── 何を訴えるか（収入アップ／時間自由／スキル習得など）' },
  { type: 'bullet', text: 'ターゲット ── 誰に向けて話すか（副業未経験の会社員／フリーランス／経営者など）' },
  { type: 'bullet', text: 'スタイル ── どう見せるか（manus／yellow／teal／premium／corporateの5種）' },
  { type: 'bullet', text: 'デモコンテンツ ── 何を動かして見せるか（LP自動制作／LINEボット構築など、ユーザーが入力）' },
  { type: 'normal', text: 'この4変数をbriefに集約し、Claude APIがテキスト設計に変換、Gemini APIが画像として具現化する2段階のAIパイプラインを構築した。' },
  { type: 'empty' },

  { type: 'bold',   text: 'スタイル設計の考え方：ブランド参照型' },
  { type: 'normal', text: '5種のスタイルは実在ブランドの視覚言語を参照している。「色とレイアウトの数値」ではなく「ブランド参照＋感情語（洗練された／力強い等）」でGeminiに指示することで、品質と再現性を両立した。' },
  { type: 'empty' },

  { type: 'bold',   text: '意図的に削ったもの' },
  { type: 'bullet', text: '厳密なデザイントークン（フォント・余白の数値・グリッドシステム）── Geminiの画像生成では数値指示の効果が薄く、ブランド参照のほうが品質が安定するため' },
  { type: 'bullet', text: '装飾の詳細指示 ── 装飾を盛りすぎるとタイムアウトの原因になる（後述の5章を参照）' },
  { type: 'empty' },

  { type: 'h2',    text: '2. スライドの構成・流れの設計意図' },
  { type: 'bold',   text: '全26枚の構成ロジック：問題提起 → 共感 → 解決策 → 証拠 → 価格 → CTA' },
  { type: 'normal', text: 'セールスプレゼンの王道フレームワーク（PASONA等）を参考に、デフォルト26枚（briefの設定で調整可能）を8つのフェーズに整理した。' },
  { type: 'empty' },
  { type: 'table_ref', id: 'TABLE_SLIDES' },
  { type: 'empty' },
  { type: 'bold',   text: '価格を後出しにした理由' },
  { type: 'normal', text: '1〜22枚目までは価格を一切出さず、23枚目で初めて提示する構成にした。先に「¥2,485,000相当」の価値積み上げを完了させてから提示することで、価格を「割安」と感じさせる効果を狙った。' },
  { type: 'empty' },

  { type: 'h2',    text: '3. 使用したAI・ツール' },
  { type: 'table_ref', id: 'TABLE_TOOLS' },
  { type: 'empty' },

  { type: 'h2',    text: '4. プロンプト連鎖・エージェント構成' },
  { type: 'bold',   text: '2段階パイプラインの全体像' },
  { type: 'normal', text: 'brief-template.md → [Step 1] plan.js × Claude API → image-design.json → [Step 2] generate.js × Gemini API → slide-N.png' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 1：plan.js（テキスト設計）' },
  { type: 'bullet', text: 'brief全文を読み込み、4変数に沿った26枚分のmain／sub／other要素をJSONとして生成' },
  { type: 'bullet', text: 'モデル：Claude API（claude-opus-4-5）' },
  { type: 'bullet', text: '出力：image-design.json' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 2：generate.js（画像生成）' },
  { type: 'bullet', text: 'image-design.jsonとスタイル定義を組み合わせてプロンプトを構築' },
  { type: 'bullet', text: 'モデル：Gemini API（gemini-3-pro-image-preview）／フォールバック：gemini-3.1-flash-image-preview' },
  { type: 'bullet', text: '1枚ずつ画像生成 → sharpで1920×1080にリサイズ統一' },
  { type: 'bullet', text: '出力：slides/output/slides/slide-N.png' },
  { type: 'empty' },

  { type: 'bold',   text: 'briefによる挙動制御（plan.js本体を編集しない設計）' },
  { type: 'normal', text: 'plan.jsはbrief全文をClaude APIにそのまま渡す実装にしているため、briefに以下のセクションを置くことで、コードを変えずにプロンプト挙動を制御できる。' },
  { type: 'bullet', text: '「固定スライドテキスト」── 特定スライドのmain文言を固定（例：デモ①②冒頭「7日後に完成する、」）' },
  { type: 'bullet', text: '「固定スライドレイアウト」── 講師写真の余白・グリッド整合などpurpose（描画指示）への制約' },
  { type: 'bullet', text: '「全体ルール」── 実在固有名詞の一般化（Gemini安全フィルタ対策）／▲などの記号回避（色コード誤認識対策）' },
  { type: 'empty' },

  { type: 'bold',   text: 'エラー耐性' },
  { type: 'normal', text: 'Gemini API 503エラー（モデル高需要時）に対し、15秒→30秒と待機時間を漸増させながら最大3回リトライし、それでも失敗した場合はフォールバックモデル（gemini-3.1-flash-image-preview）に切り替えて再度最大3回試行する機構を実装した。' },
  { type: 'empty' },

  // ───── 5. ワークフロー ─────
  { type: 'h2',     text: '5. ワークフロー' },
  { type: 'normal', text: '本システムはCLAUDE.mdに記述されたガイドラインに従い、Claude Codeが対話的に各ステップを案内する設計になっている。ユーザーは対話に答えるだけで、コマンド入力やファイル編集はClaudeが代行する。以下、初回セットアップからスライド完成までの流れを示す。【自動】はClaudeが実行し、【手動】はユーザーが実行する作業を表す。' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 0：初回セットアップ（最初の1回のみ）' },
  { type: 'bullet', text: '【手動】GitHubからリポジトリを git clone し、当該ディレクトリでClaude Codeを起動' },
  { type: 'bullet', text: '【自動】Claudeが CLAUDE.md を読み込み、対話ガイドを開始' },
  { type: 'bullet', text: '【自動】Claudeが .env / node_modules の有無をチェック' },
  { type: 'bullet', text: '【手動】ユーザーは .env に2つのAPIキー（ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY）を貼り付け' },
  { type: 'bullet', text: '【自動】不足があればClaudeが `npm install` を実行' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 1：4変数のヒアリング' },
  { type: 'bullet', text: '【自動】Claudeが「①訴求軸 → ②ターゲット → ③スタイル → ④デモコンテンツ」を1つずつ順番に質問' },
  { type: 'bullet', text: '【手動】ユーザーは番号または自由入力で回答（例：①「収入アップ」②「副業未経験の会社員」③「premium」④「LP自動制作」「案件探索自動化」）' },
  { type: 'bullet', text: '【自動】Claudeが回答をラベル名（文字列）に変換して brief-template.md の該当箇所を書き換え' },
  { type: 'bullet', text: '【自動】Claudeが grep でプレースホルダー残存をチェックし、5項目の更新内容をまとめて表示' },
  { type: 'bullet', text: '【手動】ユーザーが「はい」で承認' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 2：26枚のスライド構成を合意' },
  { type: 'bullet', text: '【自動】Claudeが構成案（01.表紙 〜 26.ROI+CTA、デモ8・9はユーザー入力で動的に表示）を提示' },
  { type: 'bullet', text: '【手動】ユーザーが「はい」で承認、または修正点を指示' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 3：テキスト設計案の生成と確認' },
  { type: 'bullet', text: '【自動】Claudeが `node slides/engine/plan.js --brief input/brief-template.md` を実行（Claude API・1〜2分）' },
  { type: 'bullet', text: '【自動】Claudeが生成された image-design.json を読み込み、全26枚分の main / sub / other を整形して表示' },
  { type: 'bullet', text: '【手動】ユーザーが内容を確認し、修正したいスライド番号と内容を指示（不要なら「はい」）' },
  { type: 'bullet', text: '【自動】修正があれば Claudeが image-design.json の該当スライドを直接編集' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 4：スライド画像の生成' },
  { type: 'bullet', text: '【自動】Claudeが `node slides/engine/generate.js --design slides/image-design.json --out slides/output` を実行（Gemini API・5〜10分）' },
  { type: 'bullet', text: '【自動】slides/output/slides/ に slide-1.png 〜 slide-26.png が出力される' },
  { type: 'bullet', text: '【手動】ユーザーが出力フォルダを開いて全枚を目視チェック' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 5：必要に応じて部分再生成' },
  { type: 'bullet', text: '【手動】ユーザーが文字化け・崩れ等の問題スライド番号を伝える' },
  { type: 'bullet', text: '【自動】Claudeが `--index 5,8,10-12` のように範囲指定して再生成（該当スライドのみ。全枚を待たない）' },
  { type: 'empty' },

  { type: 'bold',   text: 'Step 6：仕上げ（オプション）' },
  { type: 'bullet', text: '【手動】顔写真合成が必要な場合、ユーザーが input/photos/ に講師写真を配置' },
  { type: 'bullet', text: '【半自動】ユーザーが「合成して」と指示すると、Claudeが composite.js を実行し、講師スライド（10・11番）に顔写真を円形合成（自動検出した位置に85%サイズで貼付）' },
  { type: 'bullet', text: '【手動】デモスライド（8・9番）に到達したら、ユーザーがその場で実際にツールを起動して動かす（スライド単体はあくまで導入の静止画。ここで画面を切り替え、ライブで実演することがこの2枚の本来の役割）' },
  { type: 'empty' },

  { type: 'bold',   text: '自動化と手動の境界（設計判断）' },
  { type: 'normal', text: '判断・承認・素材投入は人間に残し、定型作業はすべてClaudeに任せる方針で線引きした。具体的には以下の通り。' },
  { type: 'bullet', text: '【手動に残した作業】 4変数の選択、構成案の承認、テキスト設計の承認、画像の良し悪し判定、顔写真の配置' },
  { type: 'bullet', text: '【自動化した作業】 セットアップ確認、briefファイル編集、API呼び出し、JSON読み込みと整形表示、JSON部分編集、画像生成、部分再生成のコマンド組み立て、顔写真の円形マスク処理と座標検出' },
  { type: 'empty' },

  { type: 'h2',    text: '6. こだわったポイント・難しかった部分' },
  { type: 'bold',   text: 'こだわった点' },
  { type: 'bullet', text: '再現性 ── 同じbriefから同じ構成のスライドが何度でも生成される。手作業の固定パーツをゼロにした。' },
  { type: 'bullet', text: '部分再生成 ── --indexオプションで「3枚目だけ」「5,8,10-12枚目」など柔軟な範囲指定が可能。全枚数の再生成（5〜10分）を待たずに1枚単位で調整できる。' },
  { type: 'bullet', text: '責務分離 ── plan.js（テキスト設計）とgenerate.js（画像生成）を分離。テキスト修正だけで画像生成を待たずに済み、画像だけ再生成することもできる構造。' },
  { type: 'bullet', text: 'ヒアリング堅牢化 ── brief動的項目をプレースホルダー（<ヒアリングで入力>）化、plan.js実行前にgrepで未入力を検出、さらに5項目の目視確認を必須化することで、「うっかり古い値で生成」を構造的に防止した。' },
  { type: 'empty' },

  { type: 'bold',   text: '難しかった部分（3カテゴリに整理）' },
  { type: 'empty' },

  { type: 'bold',   text: '【モデル選択の問題】' },
  { type: 'bullet', text: '日本語の文字化け ── 低品質モデル（gemini-2.0-flash-preview-image-generation）で日本語テキストが崩れる。→ 高品質モデル（gemini-3-pro-image-preview）への切り替えで解消。' },
  { type: 'bullet', text: '503エラー頻発 ── プレビューモデルのため需要集中時に503が頻発。→ リトライ機構の実装と、生成タイミング（米国夜間＝日本時間午前）の選択で対処。' },
  { type: 'empty' },

  { type: 'bold',   text: '【プロンプト設計の問題】' },
  { type: 'bullet', text: 'テキスト量とレイアウトのギャップ ── Claudeが設計するテキストが多いとGeminiが文字を小さくしすぎたり、改行で破綻したりする。→ system promptで「main体言止め必須／装飾語の削減／余白30%以上」を明示する構造的制約で緩和。' },
  { type: 'bullet', text: 'スタイル指示が重すぎてタイムアウト ── 当初は各style_descriptionに1,100〜1,400文字の詳細指示（装飾・コーナー演出・チャート仕様・テーブル仕様等）を書いていたが、夜間のGemini高負荷時に頻繁にタイムアウトした。→ 必要最低限（背景色・コアパレット・タイポグラフィ・カード基本・絵文字禁止のみ）に簡素化し、各スタイル380〜450文字（約1/3）に圧縮。生成安定性を大きく改善した。' },
  { type: 'empty' },

  { type: 'bold',   text: '【出力品質の問題】' },
  { type: 'bullet', text: '実在固有名詞の安全フィルタ反応 ── 「東京大学」「Abema・朝日新聞」などの実名でスライド生成が無音で失敗するケースが発生。→ brief側で「最難関大学」「TV・新聞・広告で多数露出」など一般表現に置換して解消。' },
  { type: 'bullet', text: '記号の色コード誤認識 ── 「▲50,000円オフ」の▲がGeminiに「#374151」のような色コードとして誤認識され、「#374151オフ」と崩れた文字列が出力された。→ 「50,000円割引」と平文で書くルールに統一して解消。' },
  { type: 'empty' },

  { type: 'h2',     text: '7. 自己評価' },

  { type: 'bold',   text: '良い点（事実ベース）' },
  { type: 'bullet', text: 'brief 1ファイルの書き換えだけで4変数の異なる複数バリエーションが生成可能。評価タスクの「再現性」要件を満たしている。' },
  { type: 'bullet', text: '全26枚の構成はセールスプレゼンの王道フレーム（PASONA等）に沿っており、ライブセミナーでそのまま使えるレベルを意識した。' },
  { type: 'bullet', text: 'plan.jsとgenerate.jsの責務分離により、テキスト修正と画像再生成を独立工程として高速に回せる。' },
  { type: 'bullet', text: 'brief-template.mdの動的項目をプレースホルダー化＋grep検証により、「うっかり古い値で生成」を構造的に防止した。' },
  { type: 'empty' },

  { type: 'bold',   text: '改善余地（時間制約で踏み込めなかった点）' },
  { type: 'bullet', text: 'フォント品質 ── Geminiの画像生成では日本語フォントの選択が制御できない。pptxやSlidev出力に切り替えれば完全制御可能だが、今回は画像出力で完結させた。' },
  { type: 'bullet', text: '生成速度 ── 26枚フルで5〜10分。並列生成（Promise.all）で高速化できるが、API rate limitとのトレードオフがあるため、今回は安定性優先で逐次処理を選択した。' },
  { type: 'bullet', text: 'デモスライドの完結性 ── デモ内容はヒアリングで動的入力対応済（タイトル冒頭「7日後に完成する、〇〇」で固定）だが、スライド単体は依然ライブデモへの橋渡し用静止画。GIF埋め込みやスクリーンショット合成で単体完結化できるが、今回は未実装。' },
  { type: 'empty' },

  // ───── まとめ ─────
  { type: 'h2',     text: 'まとめ：このシステムのキモ' },
  { type: 'normal', text: '本システムの核は「briefという1ファイルへの集約」と「plan.js／generate.jsの責務分離」の2点にある。' },
  { type: 'bullet', text: '前者は、訴求軸・ターゲット・スタイル・デモコンテンツといった評価軸の付替えコストをゼロに近づける。bullet数行を変えるだけで別バリエーションが出る。' },
  { type: 'bullet', text: '後者は、テキスト設計の修正と画像の再生成を独立工程として高速に回せる構造を提供する。1枚だけ直したい時に全体を待たない。' },
  { type: 'normal', text: 'この設計判断により、Claude Codeを「コードを書かせるAI」ではなく「組み合わせ可能な部品を組み込んだシステムの一部」として位置付けた。評価タスクが要求する「AIにやらせる」設計への、本提出物としての一つの回答である。' },
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
      ['商品説明',        '14〜22', '内容・特典を段階的に開示'],
      ['価格提示',        '23〜24', '価値積み上げ後に価格を提示／会員割引で背中を押す'],
      ['反論処理',        '25',     'FAQで心理的障壁を除去'],
      ['決断促進',        '26',     'ROI＋CTAで行動に導く'],
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
