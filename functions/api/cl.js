import { proxyJson } from "../_lib/proxy.js";

export async function onRequest(context) {
  return proxyJson(context, "https://npb-result.ant-npb.workers.dev/api/cl", 300);
}
