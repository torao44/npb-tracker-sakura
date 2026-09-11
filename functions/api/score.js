import { createResponse } from "../_lib/proxy.js";

// SPAIAのlive_games APIは「試合終了後に確定した結果」しか記録されておらず、
// 試合中のリアルタイムスコアを取得できないことが判明したため、
// Yahoo!スポーツナビ プロ野球トップページ（試合中の得点・回表裏を掲載）を
// サーバー側でスクレイピングする方式に切り替えた。
const UPSTREAM_URL = "https://baseball.yahoo.co.jp/npb/";

const TEAM_ORDER = [
  "ソフトバンク", "日本ハム", "オリックス", "楽天", "西武", "ロッテ",
  "阪神", "広島", "DeNA", "ヤクルト", "巨人", "中日"
];

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGameBlock(text) {
  const positions = TEAM_ORDER
    .map(name => ({ name, idx: text.indexOf(name) }))
    .filter(t => t.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  if (positions.length < 2) return null;

  const homeName = positions[0].name;
  const awayName = positions[1].name;

  const scoreMatch = text.match(/(\d+)\s*-\s*(\d+)/);
  const inningMatch = text.match(/(\d+)\s*回\s*(表|裏)/);
  const isFinal = text.includes("試合終了");
  const isCancelled = text.includes("中止") || text.includes("ノーゲーム");

  let gameStateName = "";
  if (isFinal) gameStateName = "試合終了";
  else if (isCancelled) gameStateName = "試合中止";

  return {
    H_Score_NameS: homeName,
    V_Score_NameS: awayName,
    H_Score_R: scoreMatch ? Number(scoreMatch[1]) : null,
    V_Score_R: scoreMatch ? Number(scoreMatch[2]) : null,
    Inning: inningMatch ? Number(inningMatch[1]) : null,
    TB: inningMatch ? inningMatch[2] : "",
    GameStateName: gameStateName,
    _rawText: text
  };
}

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);

  try {
    const response = await fetch(UPSTREAM_URL, {
      method: "GET",
      headers: {
        "Accept": "text/html",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.9"
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 30
      }
    });

    const html = await response.text();

    const gameRegex = /href="\/npb\/game\/(\d+)\/index"[^>]*>([\s\S]*?)<\/a>/g;
    const games = [];
    let m;
    while ((m = gameRegex.exec(html)) !== null) {
      const gameId = m[1];
      const text = stripTags(m[2]);
      const parsed = parseGameBlock(text);
      if (parsed) games.push({ GameID: gameId, ...parsed });
    }

    if (requestUrl.searchParams.get("debug") === "1") {
      const idx = html.indexOf("ソフトバンク");
      const rawSnippet = idx >= 0 ? html.slice(Math.max(0, idx - 800), idx + 800) : null;
      const anyGameLink = html.match(/href="[^"]*\/game\/[^"]*"/) || null;
      return createResponse(
        {
          upstreamStatus: response.status,
          htmlLength: html.length,
          gamesFoundOldRegex: games.length,
          softbankIndex: idx,
          rawSnippetAroundSoftbank: rawSnippet,
          sampleGameLinkTag: anyGameLink ? anyGameLink[0] : null
        },
        200
      );
    }

    const cleaned = games.map(({ _rawText, ...rest }) => rest);

    return createResponse(cleaned, response.status, {
      "X-Raw-Count": String(games.length),
      "X-Upstream-Status": String(response.status)
    });
  } catch (error) {
    console.error("yahoo scrape failed", error);
    return createResponse({ ok: false, error: error.message || String(error) }, 502);
  }
}
