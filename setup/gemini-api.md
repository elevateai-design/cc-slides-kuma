# Gemini API セットアップ手順

> スライド画像を生成するために、Google の Gemini API キーが必要です。
> 所要時間: 約3分。無料で取得できます。

---

## 1. API キーを取得する

1. 以下のURLにアクセス:
   **https://aistudio.google.com/apikey**

2. Google アカウントでログイン（まだの人はアカウントを作成）

3. **「Create API Key」** をクリック

4. プロジェクトを選択（どれでもOK。なければ「Create new project」）

5. 表示されたAPIキーをコピー
   - `AIzaSy...` で始まる文字列です

---

## 2. API キーを設定する

### 方法A: 毎回設定する（シンプル）

ターミナルで以下を実行（コピーしたキーに置き換える）:

```bash
export GOOGLE_AI_API_KEY="ここにコピーしたキーを貼り付ける"
```

※ターミナルを閉じるとリセットされます。

### 方法B: .env ファイルに保存する（推奨）

プロジェクトフォルダに `.env` ファイルを作成:

```bash
echo 'GOOGLE_AI_API_KEY=ここにコピーしたキーを貼り付ける' > .env
```

これで毎回設定し直す必要がなくなります。

---

## 3. 動作確認

ターミナルで以下を実行:

```bash
cd cc-slides
node slides/engine/generate.js --list-styles
```

スタイル一覧が表示されればセットアップ完了です。

---

## 料金について

- Gemini API は **無料枠** があります
- 画像生成は1日あたり一定回数まで無料で使えます
- ブートキャンプで使う程度であれば無料枠内で収まります
- 詳しくは: https://ai.google.dev/pricing

---

## トラブルシューティング

### 「API key not found」と表示される
→ `export GOOGLE_AI_API_KEY="..."` を再度実行してください

### 「quota exceeded」と表示される
→ 無料枠の上限に達しています。数分待ってから再実行してください

### 「model not found」と表示される
→ APIキーが正しく設定されているか確認してください
