export async function onRequestGet(context) {
  try {
    console.log('[YahooScore] Fetching from baseball.yahoo.co.jp/npb/');

    const response = await fetch('https://baseball.yahoo.co.jp/npb/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      console.log('[YahooScore] Fetch failed:', response.status, response.statusText);
      return new Response(JSON.stringify({ error: 'Failed to fetch from Yahoo', status: response.status }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const html = await response.text();
    console.log('[YahooScore] HTML length:', html.length);

    const games = parseYahooNpbHtml(html);
    console.log('[YahooScore] Parsed games:', games.length);

    return new Response(JSON.stringify(games), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.log('[YahooScore] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

const TEAM_INFO = {
  '巨人': { id: 1, league: 'central', full: '読売ジャイアンツ' },
  'DeNA': { id: 376, league: 'central', full: '横浜DeNAベイスターズ' },
  'ヤクルト': { id: 2, league: 'central', full: '東京ヤクルトスワローズ' },
  '阪神': { id: 5, league: 'central', full: '阪神タイガース' },
  '広島': { id: 6, league: 'central', full: '広島東洋カープ' },
  '中日': { id: 4, league: 'central', full: '中日ドラゴンズ' },
  '西武': { id: 7, league: 'pacific', full: '埼玉西武ライオンズ' },
  '日本ハム': { id: 8, league: 'pacific', full: '北海道日本ハムファイターズ' },
  'ロッテ': { id: 9, league: 'pacific', full: '千葉ロッテマリーンズ' },
  'オリックス': { id: 11, league: 'pacific', full: 'オリックス・バファローズ' },
  'ソフトバンク': { id: 12, league: 'pacific', full: '福岡ソフトバンクホークス' },
  '楽天': { id: 376, league: 'pacific', full: '東北楽天ゴールデンイーグルス' },
};

const TEAM_NAMES = Object.keys(TEAM_INFO);

function parseYahooNpbHtml(html) {
  const games = [];

  // タグ除去時に空白を挿入してチーム名の連結を防ぐ
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/>/g, '> ')
    .replace(/</g, ' <')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n');

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log('[YahooScore] Text lines:', lines.length);

  const scoreLines = lines.filter(l => /\d+\s*[-－]\s*\d+/.test(l));
  console.log('[YahooScore] Score lines found:', scoreLines.length);
  scoreLines.slice(0, 5).forEach((l, i) => console.log(`  [${i}] ${l.substring(0, 120)}`));

  for (const line of lines) {
    const scoreMatch = line.match(/(\d+)\s*[-－]\s*(\d+)/);
    if (!scoreMatch) continue;

    const rawScore1 = scoreMatch[1];
    const rawScore2 = scoreMatch[2];

    let statusDetail = '';
    let isLive = false;
    let isFinal = false;
    let isCancelled = false;
    let inning = null;
    let inningSide = null;

    if (line.includes('試合終')) {
      statusDetail = '試合終了';
      isFinal = true;
    } else if (line.includes('試合中止')) {
      statusDetail = '試合中止';
      isCancelled = true;
    } else if (line.includes('試合前')) {
      statusDetail = '試合前';
    } else if (line.includes('予告先発')) {
      statusDetail = '予告先発';
    } else {
      const inningMatch = line.match(/(\d+)回(表|裏)/);
      if (inningMatch) {
        statusDetail = inningMatch[0];
        isLive = true;
        inning = parseInt(inningMatch[1], 10);
        inningSide = inningMatch[2] === '表' ? 'top' : 'bottom';
      }
    }

    if (!statusDetail) continue;

    const teams = extractTeamsFromLine(line);
    if (teams.length < 2) {
      console.log('[YahooScore] Could not extract 2 teams from:', line.substring(0, 100));
      continue;
    }

    const [awayTeam, homeTeam] = teams;
    const awayScore = parseInt(rawScore1, 10);
    const homeScore = parseInt(rawScore2, 10);

    const info = TEAM_INFO[homeTeam];

    games.push({
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      inning,
      inningSide,
      isLive,
      isFinal,
      isCancelled,
      statusDetail,
      league: info ? info.league : 'unknown',
      _source: 'yahoo',
    });
  }

  return games;
}

function extractTeamsFromLine(line) {
  const matches = [];

  for (const name of TEAM_NAMES) {
    const pattern = '(?:^|\\s|　|[(（）)])' + escapeRegex(name) + '(?:$|\\s|　|[(（）)])';
    const regex = new RegExp(pattern, 'g');
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push({ name, index: match.index });
    }
  }

  // 出現位置順にソート
  matches.sort((a, b) => a.index - b.index);

  const unique = [];
  const seen = new Set();
  for (const m of matches) {
    if (!seen.has(m.name)) {
      seen.add(m.name);
      unique.push(m.name);
    }
  }

  return unique.slice(0, 2);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
