// _worker.js（リポジトリルートに配置）
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/api/history')) {
      return fetch('https://spaia.jp/baseball/npb/api/official_stats_history' + url.search, request);
    }
    if (url.pathname.startsWith('/api/schedules')) {
      return fetch('https://spaia.jp/baseball/npb/api/schedules' + url.search, request);
    }
    if (url.pathname === '/api/cl') {
      return fetch('https://npb-result.ant-npb.workers.dev/api/cl', request);
    }
    if (url.pathname === '/api/pl') {
      return fetch('https://npb-result.ant-npb.workers.dev/api/pl', request);
    }
    
    // 静的ファイルはそのまま返す
    return env.ASSETS.fetch(request);
  }
};