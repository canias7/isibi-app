// THE SITE'S TRAFFIC, FROM CLOUDFLARE'S OWN ANALYTICS (owner, 2026-10-26: no
// new storage). One read-only GraphQL query to Cloudflare's Analytics API,
// dataset `httpRequestsAdaptiveGroups` at the account, filtered to the job's
// own site's hosts only (`<slug>.gofarther.app` and its live custom domain),
// visitors only (`requestSource: "eyeball"`), HTML answers only (page views),
// at most 30 days. Counts only: page views and visits per day and per page
// (top 10). Cached five minutes per site and range. Honest when it cannot:
// no token, no account, a failed query or an error answer is "unavailable".
export const TRAFFIC_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
export const TRAFFIC_MAX_DAYS = 30;
export const TRAFFIC_TOP_PAGES = 10;
const CACHE_MS = 5 * 60_000;

const QUERY = `query SiteTraffic($account: string!, $filter: AccountHttpRequestsAdaptiveGroupsFilter_InputObject!) {
  viewer { accounts(filter: { accountTag: $account }) {
    httpRequestsAdaptiveGroups(limit: 5000, filter: $filter) {
      count
      sum { visits }
      dimensions { date clientRequestPath }
    }
  } }
}`;

const set = (v) => typeof v === "string" && v.trim() !== "" && v.trim() !== "-";
/** The token: the dedicated analytics one, else the existing Cloudflare token. Never shown. */
export function trafficToken(env) {
  if (env && set(env.CF_ANALYTICS_TOKEN)) return env.CF_ANALYTICS_TOKEN.trim();
  if (env && set(env.CLOUDFLARE_API_TOKEN)) return env.CLOUDFLARE_API_TOKEN.trim();
  return "";
}

const HOST = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** The variables of the one query. Hosts are the caller's (the job's site), never the model's. */
export function trafficVariables({ account, hosts, days, now = Date.now() }) {
  const d = Math.max(1, Math.min(TRAFFIC_MAX_DAYS, Number.isInteger(days) ? days : 7));
  const list = [...new Set((hosts || []).map((h) => String(h || "").toLowerCase()).filter((h) => HOST.test(h)))].slice(0, 4);
  return {
    account,
    filter: {
      datetime_geq: new Date(now - d * 86_400_000).toISOString().slice(0, 19) + "Z",
      datetime_leq: new Date(now).toISOString().slice(0, 19) + "Z",
      requestSource: "eyeball",
      edgeResponseContentTypeName: "html",
      OR: list.map((h) => ({ clientRequestHTTPHost: h })),
    },
    days: d,
    hosts: list,
  };
}

/** Groups to counts: per day, and the top pages. */
export function summarize(groups, days) {
  const byDay = new Map(), byPath = new Map();
  let views = 0, visits = 0;
  for (const g of Array.isArray(groups) ? groups : []) {
    const n = Number(g && g.count) || 0, v = Number(g && g.sum && g.sum.visits) || 0;
    const day = String((g && g.dimensions && g.dimensions.date) || "").slice(0, 10);
    const path = String((g && g.dimensions && g.dimensions.clientRequestPath) || "/").split("?")[0].slice(0, 120);
    views += n; visits += v;
    const a = byDay.get(day) || { day, page_views: 0, visits: 0 }; a.page_views += n; a.visits += v; byDay.set(day, a);
    const b = byPath.get(path) || { page: path, page_views: 0, visits: 0 }; b.page_views += n; b.visits += v; byPath.set(path, b);
  }
  return {
    days, page_views: views, visits,
    per_day: [...byDay.values()].sort((x, y) => (x.day < y.day ? -1 : 1)),
    top_pages: [...byPath.values()].sort((x, y) => y.page_views - x.page_views).slice(0, TRAFFIC_TOP_PAGES),
  };
}

const cache = new Map();
/** The site's traffic, or the string "unavailable: …". Never throws. */
export async function siteTraffic({ env, hosts, days, fetchImpl = fetch, now = Date.now() } = {}) {
  try {
    const token = trafficToken(env);
    const account = env && set(env.CLOUDFLARE_ACCOUNT_ID) ? env.CLOUDFLARE_ACCOUNT_ID.trim() : "";
    if (!token || !account) return "unavailable: no Cloudflare analytics token is set";
    const vars = trafficVariables({ account, hosts, days, now });
    if (!vars.hosts.length) return "unavailable: the site has no address";
    const key = vars.hosts.join(",") + "|" + vars.days;
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_MS) return hit.v;
    const r = await fetchImpl(TRAFFIC_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ query: QUERY, variables: { account: vars.account, filter: vars.filter } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return "unavailable: Cloudflare analytics answered " + r.status;
    const j = await r.json();
    if (j && Array.isArray(j.errors) && j.errors.length) return "unavailable: Cloudflare analytics refused the query";
    const acc = j && j.data && j.data.viewer && Array.isArray(j.data.viewer.accounts) ? j.data.viewer.accounts[0] : null;
    if (!acc || !Array.isArray(acc.httpRequestsAdaptiveGroups)) return "unavailable: Cloudflare analytics gave no data";
    const v = { hosts: vars.hosts, ...summarize(acc.httpRequestsAdaptiveGroups, vars.days) };
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: now, v });
    return v;
  } catch { return "unavailable: Cloudflare analytics could not be read"; }
}
export const _trafficCache = cache;
