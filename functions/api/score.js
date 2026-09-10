import { createResponse } from "../_lib/proxy.js";

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const gameId = requestUrl.searchParams.get("gameId");

  // SPAIA live_games APIから全試合データを取得
  const upstreamUrl = "https://spaia.jp/baseball/npb/api/live_games";

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "NPB-Season-Tracker/1.3.2"
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

    // 当日（JST）の試合だけをフィルタリング
    const now = new Date();
    const jstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const year = jstDate.getFullYear();
    const month = String(jstDate.getMonth() + 1).padStart(2, "0");
    const day = String(jstDate.getDate()).padStart(2, "0");
    const todayStr = `${year}${month}${day}`; // 例: "20260910"

    const todaysGames = allGames.filter(g => {
      // GameIDの先頭8文字が日付 (例: 20260910...)
      const gameIdStr = String(g.GameID || "");
      if (gameIdStr.length >= 8) {
        const gameDate = gameIdStr.substring(0, 8);
        return gameDate === todayStr;
      }
      // DateJPNフィールドがある場合
      const dateJpn = String(g.DateJPN || g.dateJPN || g.DATE_JPN || "");
      if (dateJpn.length >= 8) {
        return dateJpn.substring(0, 8) === todayStr;
      }
      // gameDateフィールド
      const gameDateField = String(g.gameDate || g.GAME_DATE || "");
      if (gameDateField) {
        const normalized = gameDateField.replace(/-/g, "").substring(0, 8);
        return normalized === todayStr;
      }
      return false;
    });

    if (!gameId) {
      return createResponse(todaysGames, response.status);
    }

    // gameIdで特定の試合を検索
    const game = todaysGames.find(g => g.GameID === gameId || g.GameID == gameId);

    if (game) {
      return createResponse([game], response.status);
    } else {
      return createResponse([], 200);
    }
  } catch (error) {
    console.error("live_games fetch failed", error);
    return createResponse({ ok: false, error: error.message || String(error) }, 502);
  }
}
