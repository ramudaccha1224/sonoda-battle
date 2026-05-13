# デプロイ手順

スマホから 2 人で対戦するためのサーバー公開手順。

## 構成

```
   ┌──── スマホ（ブラウザ）─────┐
   │                           │
   ▼                           ▼
[Vercel: Next.js]   ←HTTPS→  [Railway: Socket.io]
       └──────── 1 つの GitHub リポジトリから両方デプロイ ──────┘
```

| 役割 | サービス | 無料枠 | 何をする |
|---|---|---|---|
| フロントエンド | [Vercel](https://vercel.com) | Hobby プラン (無料) | Next.js を `next build` してホスト |
| Socket サーバー | [Railway](https://railway.app) | $5/月 のクレジット (無料試用) | `tsx server/index.ts` を常時起動 |

両方とも **GitHub と連携してプッシュで自動デプロイ** する想定。

---

## Step 0: GitHub にコードを push

すでに git init + initial commit までは済んでいる。
GitHub にリポジトリを作って push する:

### GitHub CLI が入っている場合（推奨）
```bash
cd okaeri-sonoda-battle
# 例: private リポジトリで作成
gh repo create okaeri-sonoda-battle --private --source=. --remote=origin --push
```

### CLI が無い場合
1. https://github.com/new で `okaeri-sonoda-battle` というリポジトリを作成
2. ローカルから push
   ```bash
   cd okaeri-sonoda-battle
   git remote add origin https://github.com/<your-name>/okaeri-sonoda-battle.git
   git push -u origin main
   ```

---

## Step 1: Railway に Socket サーバーをデプロイ

1. https://railway.app/new を開く
2. **"Deploy from GitHub repo"** をクリック → 初回は GitHub 連携の許可
3. 作ったリポジトリを選択
4. Railway は [`railway.json`](./railway.json) を読んで自動で:
   - `npm install`
   - `npm run start:server` で `tsx server/index.ts` を起動
   - `/health` でヘルスチェック
5. デプロイ完了したら、Service → **"Settings"** → **"Networking"** → **"Generate Domain"** をクリック
6. `https://<your-app>.up.railway.app` のような URL がもらえる。**メモする**

### 動作確認
ブラウザで `https://<your-app>.up.railway.app/health` にアクセス →
`ok` と表示されれば成功。

---

## Step 2: Vercel にフロントをデプロイ

1. https://vercel.com/new を開く
2. **"Import Git Repository"** → 初回は GitHub 連携の許可
3. 同じリポジトリを Import
4. **Framework Preset: Next.js** が自動検出される。そのまま
5. **"Environment Variables"** セクションを開く:
   - **Key**: `NEXT_PUBLIC_SOCKET_URL`
   - **Value**: Step 1 で取得した Railway の URL（例: `https://your-app.up.railway.app`）
6. **"Deploy"** をクリック
7. 完了すると `https://<your-app>.vercel.app` の URL がもらえる

> ※ `.vercelignore` で `server/` を除外しているので、Vercel ビルドは Next.js だけが対象。

---

## Step 3: 必要なら CORS を絞り込む

Railway サーバーは現状 `cors: { origin: "*" }` で全許可。
本番では Vercel の URL に絞ったほうが安心:

1. Railway の Service → Variables に追加:
   - **Key**: `CORS_ORIGIN`
   - **Value**: `https://<your-app>.vercel.app`
2. 自動再デプロイされる

---

## Step 4: スマホで対戦

1. プレイヤー A: スマホで `https://<your-app>.vercel.app` を開く
2. 名前を入れて「ルームを作って対戦相手を待つ」
3. 「URLコピー」で共有 URL を取得
4. プレイヤー B: その URL を別のスマホで開く
5. 両者がパーティを 2 体ずつ選択 → バトル開始！

---

## トラブルシューティング

### バトルが始まらない / コマンドが届かない
- スマホのブラウザのコンソールを開いて (DevTools) `WebSocket` のエラーを確認
- `NEXT_PUBLIC_SOCKET_URL` を URL バーで叩いて `ok` が返ってくるか
- Railway サービスのログを確認

### Railway が「健康診断」で落ち続ける
- `/health` が 200 を返しているか
- ポートは `process.env.PORT` を使っているか (`server/index.ts` で対応済み)

### Vercel ビルドが失敗する
- `package.json` の `engines` を確認 (現状指定なし)
- Next.js のバージョンと Node のバージョンの相性

### コードを変更した後
- ローカルで `git add . && git commit -m "..." && git push`
- Railway / Vercel が自動で再デプロイする

---

## 料金についてのメモ

- **Vercel**: Hobby プランは個人用途で無料。商用利用や独自ドメインで上位プランへ
- **Railway**: 無料試用クレジット $5/月。小規模 socket サーバーなら数十円〜数百円/月程度の消費
  - 使ってないときは "Sleep" 設定で消費を抑えられる

本番運用するなら独自ドメインや SSL の確認も。
