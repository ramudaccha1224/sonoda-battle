# おかえりそのだくん・バトル

ポケモンスタジアム風の 3D 2 対 2 ターン制対戦ゲーム（プロトタイプ）。

## 技術スタック

| レイヤー         | 採用技術                                                  |
| ---------------- | --------------------------------------------------------- |
| Frontend         | Next.js 14 (App Router) / React 18 / Tailwind CSS         |
| 3D 描画          | React Three Fiber (Three.js) + drei                       |
| リアルタイム通信 | Socket.io (server: Node.js / client: socket.io-client)    |
| State            | Zustand                                                   |
| 言語             | TypeScript                                                |

## ディレクトリ構成

```
okaeri-sonoda-battle/
├── app/                       # Next.js ページ
│   ├── page.tsx               # ランディング (ルーム作成 / 参加)
│   └── battle/[roomId]/page.tsx
├── components/
│   ├── canvas/                # 3D (Three.js) — 描画のみ
│   │   ├── BattleScene.tsx
│   │   ├── Stadium.tsx
│   │   └── MonsterMesh.tsx
│   └── ui/                    # 2D UI
│       ├── CommandPanel.tsx
│       ├── PartyBar.tsx
│       ├── PartySelect.tsx
│       ├── HpBar.tsx
│       └── BattleLog.tsx
├── lib/
│   ├── battle/                # 純粋なバトルロジック (描画/通信に非依存)
│   │   ├── BattleEngine.ts
│   │   ├── damage.ts
│   │   └── types.ts
│   ├── monsters/
│   │   ├── Monster.ts         # 抽象 Monster クラス
│   │   ├── definitions.ts     # 6 体の定義
│   │   └── moves.ts
│   └── net/
│       ├── events.ts          # サーバー/クライアント共通の Socket イベント契約
│       └── socket.ts          # クライアント側 socket シングルトン
├── server/
│   └── index.ts               # Socket.io シグナリング & バトルホスト
└── store/
    └── battleStore.ts         # Zustand ストア
```

### 設計方針

- **ロジック (`lib/battle`, `lib/monsters`) と描画 (`components/canvas`) は完全分離**。
  `BattleEngine` は `three` も `react` も知らない純 TypeScript。
- **`Monster` は抽象クラス**。`MonsterDefinition.modelUrl` を埋めれば、`MonsterMesh.tsx` で
  `useGLTF(def.modelUrl)` に差し替えるだけで 3D モデル化できる構造。
- **サーバー側でも `BattleEngine` をそのまま実行**しているので、ロジックの二重実装はない。

## 起動方法

### 1. 依存インストール

```bash
cd okaeri-sonoda-battle
npm install
```

### 2. 環境変数（任意）

```bash
cp .env.example .env.local
```

デフォルト: フロントは `http://localhost:3000`、Socket サーバーは `http://localhost:3001`。

### 3. 開発サーバ起動（2 つ同時）

```bash
npm run dev:all          # Next.js + Socket.io を同時起動
```

または別ターミナルで個別起動:

```bash
npm run dev:server       # ターミナル1: Socket.io (port 3001)
npm run dev              # ターミナル2: Next.js (port 3000)
```

### 4. プレイ

1. ブラウザを 2 つ開く（別ウィンドウ／別ブラウザ／シークレットモード推奨）
2. 1 つ目: `http://localhost:3000` → 「ルームを作って対戦相手を待つ」
3. URL コピーボタンで共有 URL を取得
4. 2 つ目: その URL を開く
5. 両者がパーティ（2 体）を選んだらバトル開始
6. 両者がコマンドを送ったらターンが解決される

## キャラクター一覧

| ID     | 名前       | 色      | 特徴                       |
| ------ | ---------- | ------- | -------------------------- |
| sonoda | そのだくん | 白      | バランス型（HP 高め）      |
| mimura | みむら     | グレー  | バランス型                 |
| kurobe | くろべ     | 黒      | 特攻・素早さ型             |
| abe    | あべ       | 茶      | **高スピード型 (速 120)**  |
| oguri  | おぐり     | 三毛茶  | **高防御型 (防 110)**      |
| toda   | とだ       | ベージュ | 特防型                     |

## デプロイの想定

- **Frontend**: Vercel に push して `next start` を動かす
- **Socket サーバー**: Railway / Render / Fly.io に `npm run start:server` を動かす
- フロントの `NEXT_PUBLIC_SOCKET_URL` に Socket サーバーの公開 URL を設定

## 今後の拡張ポイント

- [ ] GLTF モデル差し替え（`MonsterDefinition.modelUrl` を使う）
- [ ] 技のアニメーション（パーティクル / カメラシェイク）
- [ ] BGM / SE
- [ ] 観戦者モード
- [ ] AI 相手 (シングルプレイ)
- [ ] ステータスログを Replay / 共有
