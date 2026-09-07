# NPB シーズントラッカー — Cloudflare Pages版

このリポジトリは、GitHub連携のCloudflare Pagesへそのまま配置できる構成です。

## ファイル構成

```text
npb-tracker-cloudflare-pages/
├─ public/
│  └─ index.html             # 表示画面（v1.1.8）
├─ functions/
│  ├─ _lib/
│  │  └─ proxy.js            # API中継の共通処理
│  └─ api/
│     ├─ history.js          # /api/history
│     ├─ schedules.js        # /api/schedules
│     ├─ cl.js               # /api/cl
│     └─ pl.js               # /api/pl
├─ .gitignore
└─ README.md
```

## GitHubへアップロード

ZIPを展開し、展開後のフォルダ内にあるファイルとフォルダを、GitHubリポジトリのルートへアップロードしてください。

重要: ZIPファイル自体をGitHubへ置くのではなく、ZIPを展開してからアップロードします。

## Cloudflare Pagesの設定

Cloudflareダッシュボードで新しい **Pages** プロジェクトを作り、GitHubリポジトリを接続します。

- Production branch: `main`
- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `public`
- Root directory: 空欄
- Deploy command: 設定しない

`npx wrangler deploy` は入力しないでください。

## このリポジトリにれないファイル

以下は別用途なので、このPagesリポジトリには不要です。

- `wrangler.toml`（NPBデータ収集Worker用）
- `netlify.toml`（Netlify用）
- `_redirects`（この構成では不要）
- `_worker.js`（この構成では不要）
- `.assetsignore`（この構成では不要）

## デプロイ後の確認

1. 発行された `https://プロジェクト名.pages.dev/` を開く
2. フッターが `v1.1.8 (2026-09-07)` になっているか確認
3. ブラウザの開発者ツール → ネットワークを開く
4. 「両リーグ更新」を押す
5. 次のリクエストを確認
   - `/api/history?GameAssortment=1&Year=2026`
   - `/api/history?GameAssortment=2&Year=2026`
   - `/api/schedules?Year=2026`
   - 必要に応じて `/api/cl` と `/api/pl`

APIが成功すれば、ステータス欄に `200` が表示され、レスポンスにJSONが表示されます。

## 注意

画面の「設定・バックアップ」に収集サーバーURLが保存されている場合、「両リーグ更新」は先にその収集サーバーを使用します。Pages内蔵APIだけを試す場合は、「切断して内蔵APIに戻す」を押してください。

