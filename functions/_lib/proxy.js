export function createResponse(body, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30",
    "X-Content-Type-Options": "nosniff"
  });
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function proxyJson(context, upstreamBase, cacheSeconds = 300) {
  const requestUrl = new URL(context.request.url);
  const upstreamUrl = new URL(upstreamBase);
  upstreamUrl.search = requestUrl.search;

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonError(405, "Method Not Allowed");
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: context.request.method,
      headers: {
        "Accept": "application/json",
        "User-Agent": "NPB-Season-Tracker/1.2.0"
      },
      cf: {
        cacheEverything: true,
        cacheTtl: cacheSeconds
      }
    });

    const headers = new Headers();
    headers.set("Content-Type", upstreamResponse.headers.get("Content-Type") || "application/json; charset=utf-8");
    headers.set("Cache-Control", `public, max-age=${cacheSeconds}`);
    headers.set("X-Upstream-Status", String(upstreamResponse.status));
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  } catch (error) {
    console.error("Upstream fetch failed", upstreamUrl.toString(), error);
    return jsonError(502, "Upstream API request failed", error?.message || String(error));
  }
}

function jsonError(status, message, detail = "") {
  return new Response(JSON.stringify({ ok: false, status, message, detail }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
