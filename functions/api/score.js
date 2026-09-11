import { createResponse } from "../_lib/proxy.js";

// SPAIAのlive_games APIは「試合終了後に確定した結果」しか記録されておらず、
// 試合中のリアルタイムスコアを取得できないことが判明したため、
// Yahoo!スポーツナビ プロ野球トップページ（試合中の得点・回表裏を掲載）を
// サーバー側でスクレイピングする方式に切り替えた。
// 実際のHTML構造（2026年9月時点）:
// <li class="bb-score__item ...">
//   <a class="bb-score__content" href="https://baseball.yahoo.co.jp/npb/game/<ID>/index">
//     <p class="bb-score__homeLogo ...">チームA</p>
//     <p class="bb-score__awayLogo ...">チームB</p>
//     <span class="bb-score__score bb-score__score--left">10</span>-<span class="bb-score__score bb-score__score--right">1</span>
//     <p class="bb-score__link">8回表</p>  (または「試合終了」「試合中止」「18:00開始」等)
//   </a>
// </li>
const UPSTREAM_URL = "https://baseball.yahoo.co.jp/npb/";

function parseGameBlock(block) {
  const idMatch = block.match(/npb\/game\/(\d+)\/index/);
  if (!idMatch) return null;

  const homeMatch = block.match(/bb-score__homeLogo[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>/);
  const awayMatch = block.match(/bb-score__awayLogo[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>/);
  if (!homeMatch || !awayMatch) return null;

  const leftScoreMatch = block.match(/bb-score__score--left"[^>]*>\s*(\d+)\s*<\/span>/);
  const rightScoreMatch = block.match(/bb-score__score--right"[^>]*>\s*(\d+)\s*<\/span>/);

  const statusMatch = block.match(/bb-score__link"[^>]*>\s*([^<]+?)\s*<\/p>/);
  const statusText = statusMatch ? statusMatch[1] : "";

  const inningMatch = statusText.match(/(\d+)\s*回\s*(表|裏)/);
  const isFinal = statusText.includes("試合終了");
  const isCancelled = statusText.includes("中止") || statusText.includes("ノーゲーム");

  let gameStateName = "";
  if (isFinal) gameStateName = "試合終了";
  else if (isCancelled) gameStateName = "試合中止";

  return {
    GameID: idMatch[1],
    H_Score_NameS: homeMatch[1].trim(),
    V_Score_NameS: awayMatch[1].trim(),
    H_Score_R: leftScoreMatch ? Number(leftScoreMatch[1]) : null,
    V_Score_R: rightScoreMatch ? Number(rightScoreMatch[1]) : null,
    Inning: inningMatch ? Number(inningMatch[1]) : null,
    TB: inningMatch ? inningMatch[2] : "",
    GameStateName: gameStateName,
    _statusText: statusText
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

    const blockRegex = /<li class="bb-score__item[^"]*">([\s\S]*?)(?=<li class="bb-score__item|<\/ul>)/g;
    const games = [];
    let m;
    while ((m = blockRegex.exec(html)) !== null) {
      const parsed = parseGameBlock(m[1]);
      if (parsed) games.push(parsed);
    }

    if (requestUrl.searchParams.get("debug") === "1") {
      return createResponse(
        {
          upstreamStatus: response.status,
          htmlLength: html.length,
          gamesFound: games.length,
          games
        },
        200
      );
    }

    const cleaned = games.map(({ _statusText, ...rest }) => rest);

    return createResponse(cleaned, response.status, {
      "X-Raw-Count": String(games.length),
      "X-Upstream-Status": String(response.status)
    });
  } catch (error) {
    console.error("yahoo scrape failed", error);
    return createResponse({ ok: false, error: error.message || String(error) }, 502);
  }
}
