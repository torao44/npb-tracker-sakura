// /api/score.js - Fetch live score for a specific game from SPAIA
import { createResponse } from "../functions/_lib/proxy.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId") || url.searchParams.get("game_id") || "";

  if (!gameId) {
    return createResponse({ error: "gameId required" }, 400);
  }

  try {
    const target = `https://spaia.jp/baseball/npb/api/current_score?game_id=${encodeURIComponent(gameId)}`;
    const res = await fetch(target, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "NPB-Tracker/1.2.2"
      },
      cf: { cacheTtl: 30, cacheEverything: true }
    });

    if (!res.ok) {
      return createResponse({ error: `SPAIA returned ${res.status}` }, 502);
    }

    const data = await res.json();
    return createResponse(data, 200, {
      "Cache-Control": "public, max-age=30, s-maxage=30"
    });
  } catch (e) {
    return createResponse({ error: e.message }, 500);
  }
}
