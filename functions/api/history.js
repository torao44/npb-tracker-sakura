import { proxyJson } from "../_lib/proxy.js";

export async function onRequest(context) {
  return proxyJson(context, "https://spaia.jp/baseball/npb/api/official_stats_history", 900);
}
