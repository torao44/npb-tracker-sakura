# NPB シーズントラッカー — Cloudflare Pages版

このリポジトリは、GitHub連携のCloudflare Pagesへそのまま配置できる構成です。

## ファイル構成

```text
npb-tracker-cloudflare-pages/
├─ public/
│  └─ index.html             # 表示画面（v1.2.0）
├─ functions/
│  ├─ _lib/
│  │  └─ proxy.js            # API中継の共通処理
│  └─ api/
│     ├─ history.js          # /api/history
│     ├─ schedules.js        # /api/schedules
│     ├─ starters.js         # /api/starters（NPB公式の予告先発）
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
2. フッターが `v1.2.0 (2026-09-08)` になっているか確認
3. ブラウザの開発者ツール → ネットワークを開く
4. 「両リーグ更新」を押す
5. 次のリクエストを確認
   - `/api/history?GameAssortment=1&Year=2026`
   - `/api/history?GameAssortment=2&Year=2026`
   - `/api/schedules?Year=2026`
   - `/api/starters`
   - 必要に応じて `/api/cl` と `/api/pl`

APIが成功すれば、ステータス欄に `200` が表示され、レスポンスにJSONが表示されます。

## 注意

画面の「設定・バックアップ」に収集サーバーURLが保存されている場合、「両リーグ更新」は先にその収集サーバーを使用します。Pages内蔵APIだけを試す場合は、「切断して内蔵APIに戻す」を押してください。

## v1.2.0の変更

- 試合予定カードに得点、イニング、表裏、終了・中止状態を表示
- 進行中の試合は緑色で強調し、最終取得時刻を表示
- 試合開始時刻の直前から試合状況を自動確認
- 「試合予定」タブ表示中は進行中の試合を60秒間隔で更新
- 別タブ表示中は180秒間隔に抑え、ページ非表示中は更新を停止
- 当日終了した試合も試合予定欄に残して結果を表示
- `/api/schedules` のCloudflareキャッシュを30秒へ短縮
- NPB公式の予告先発補完はv1.1.9から継続

### ライブ表示について

表示できる内容は上流のスケジュールAPIが返す項目に依存します。得点やイニングが未提供の場合は、取得できた範囲だけを表示します。ライブ更新に失敗しても順位表や保存済みデータの表示は継続します。
