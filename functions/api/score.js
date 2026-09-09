import { createResponse } from "../_lib/proxy.js";

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const gameId = requestUrl.searchParams.get("gameId");

  // SPAIA live_games APIから全試合データを取得（current_scoreはgame_id形式が不安定なため）
  const upstreamUrl = "https://spaia.jp/baseball/npb/api/live_games";

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "NPB-Season-Tracker/1.2.4"
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 30
      }
    });

    const allGames = await response.json();

    if (!Array.isArray(allGames)) {
      return createResponse({ ok: false, error: "Invalid response from upstream" }, 502);
    }

    if (!gameId) {
      return createResponse(allGames, response.status);
    }

    // gameIdで特定の試合を検索
    const game = allGames.find(g => g.GameID === gameId || g.GameID == gameId);

    if (game) {
      return createResponse([game], response.status);
    } else {
      // 試合が見つからない場合は空配列を返す（進行中でない可能性）
      return createResponse([], 200);
    }
  } catch (error) {
    console.error("live_games fetch failed", error);
    return createResponse({ ok: false, error: error.message || String(error) }, 502);
  }
}
