const TEAM_DEFS = [
  { id: 1, names: ["読売ジャイアンツ", "読売巨人軍"] },
  { id: 2, names: ["東京ヤクルトスワローズ", "ヤクルトスワローズ"] },
  { id: 3, names: ["横浜DeNAベイスターズ", "DeNAベイスターズ"] },
  { id: 4, names: ["中日ドラゴンズ"] },
  { id: 5, names: ["阪神タイガース"] },
  { id: 6, names: ["広島東洋カープ"] },
  { id: 7, names: ["埼玉西武ライオンズ", "西武ライオンズ"] },
  { id: 8, names: ["北海道日本ハムファイターズ", "日本ハムファイターズ"] },
  { id: 9, names: ["千葉ロッテマリーンズ", "ロッテマリーンズ"] },
  { id: 11, names: ["オリックス・バファローズ", "オリックスバファローズ"] },
  { id: 12, names: ["福岡ソフトバンクホークス", "ソフトバンクホークス"] },
  { id: 376, names: ["東北楽天ゴールデンイーグルス", "楽天ゴールデンイーグルス"] }
];

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return json({ ok: false, message: "Method Not Allowed" }, 405, 0);
  }
  try {
    const upstream = await fetch("https://npb.jp/announcement/starter/", {
      headers: { "Accept": "text/html,application/xhtml+xml", "User-Agent": "NPB-Season-Tracker/1.2.0" },
      cf: { cacheEverything: true, cacheTtl: 300 }
    });
    if (!upstream.ok) return json({ ok: false, message: `NPB upstream HTTP ${upstream.status}`, games: [] }, 502, 0);
    const html = await upstream.text();
    const parsed = parseStarterPage(html);
    return json({ ok: true, ...parsed, sourceUrl: "https://npb.jp/announcement/starter/", fetchedAt: new Date().toISOString() }, 200, 300);
  } catch (error) {
    console.error("Starter fetch failed", error);
    return json({ ok: false, message: "予告先発を取得できませんでした", detail: error?.message || String(error), games: [] }, 502, 0);
  }
}

function parseStarterPage(html) {
  const headingMatches = [...html.matchAll(/(\d{1,2})月(\d{1,2})日の予告先発投手/g)];
  const heading = headingMatches.at(-1);
  if (!heading) return { date: "", games: [], warning: "予告先発の見出しを検出できませんでした" };
  const month = Number(heading[1]), day = Number(heading[2]);
  const date = toJstDate(month, day);
  const section = html.slice(heading.index, heading.index + 70000);
  const entries = [];

  for (const def of TEAM_DEFS) {
    let best = null;
    for (const name of def.names) {
      const patterns = [
        new RegExp(`alt=["'][^"']*${escapeRegExp(name)}[^"']*["']`, "i"),
        new RegExp(`>${escapeRegExp(name)}<`, "i")
      ];
      for (const pattern of patterns) {
        const match = pattern.exec(section);
        if (match && (!best || match.index < best.index)) best = { index: match.index, name };
      }
    }
    if (!best) continue;
    const nearby = section.slice(best.index, best.index + 3500);
    const player = nearby.match(/<a[^>]+href=["'][^"']*\/bis\/players\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
    const pitcher = player ? cleanText(player[1]) : "";
    if (pitcher) entries.push({ index: best.index, id: def.id, team: best.name, pitcher });
  }

  entries.sort((a, b) => a.index - b.index);
  const games = [];
  for (let i = 0; i + 1 < entries.length; i += 2) {
    const home = entries[i], away = entries[i + 1];
    games.push({
      date,
      home: home.id,
      away: away.id,
      homePitcher: home.pitcher,
      awayPitcher: away.pitcher,
      source: "NPB公式"
    });
  }
  return { date, games, count: games.length };
}

function cleanText(value) {
  return decodeEntities(String(value).replace(/<[^>]*>/g, " ").replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim());
}
function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function toJstDate(month, day) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const current = Object.fromEntries(parts.map(p => [p.type, p.value]));
  let year = Number(current.year), currentMonth = Number(current.month);
  if (currentMonth === 12 && month === 1) year++;
  if (currentMonth === 1 && month === 12) year--;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function json(data, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
