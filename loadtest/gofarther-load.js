// gofarther.dev — k6 load test
// ---------------------------------------------------------------------------
// Exercises the paths that actually matter under concurrency, WITHOUT spending
// any generation money (no /api/video|image|audio, no /api/direct):
//   • Scenario "page"    — static page + JS/CSS from the Cloudflare edge/Worker
//   • Scenario "credits" — GET /api/credits (Worker → GoTrue auth verify →
//                          Postgres get_credits RPC). This is the read path that
//                          hits your real database + auth, i.e. the bottleneck
//                          you care about. It is read-only (no charge).
//
// ⚠️  This hits PRODUCTION (gofarther.dev) and its live Supabase by default. It is
//     read-only and spends no fal/Anthropic money, but it IS real load on your
//     DB — run it deliberately, and Ctrl-C to stop at any time.
//
// USAGE
//   1. Install k6:  https://k6.io/docs/get-started/installation/
//      (macOS: `brew install k6`)
//   2. Grab a session token — open gofarther.dev signed in, then in the browser
//      console:  JSON.parse(localStorage.zephyr_session_v1).access_token
//   3. Raise the file-descriptor limit for high VU counts:  ulimit -n 250000
//   4. Run (safe defaults — page ramps to 1000, credits to 100):
//        k6 run -e TOKEN=<paste-token> gofarther-load.js
//      Push the DB path harder once you trust it:
//        k6 run -e TOKEN=<token> -e API_VUS=1000 -e PAGE_VUS=1000 gofarther-load.js
//      Static-only (no token, zero DB load):
//        k6 run gofarther-load.js
//      Point at staging instead of prod:
//        k6 run -e BASE_URL=https://staging.example.com -e TOKEN=<token> gofarther-load.js
// ---------------------------------------------------------------------------

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE      = __ENV.BASE_URL  || 'https://gofarther.dev';
const TOKEN     = __ENV.TOKEN     || '';                       // Supabase access_token (optional)
const PAGE_VUS  = parseInt(__ENV.PAGE_VUS || '1000', 10);       // peak VUs for the static path
const API_VUS   = parseInt(__ENV.API_VUS  || '100', 10);        // peak VUs for the authed read path
const RAMP      = __ENV.RAMP      || '1m';                      // time to ramp to peak
const HOLD      = __ENV.HOLD      || '2m';                      // time held at peak

// Custom pass/fail signals
const pageFail  = new Rate('page_fail');       // non-200 page loads
const apiFail   = new Rate('api_fail');        // non-200 credits calls
const api429    = new Rate('api_429');         // DB/quota backpressure surfacing as 429/503
const apiLat    = new Trend('api_latency_ms', true);

export const options = {
  discardResponseBodies: true, // we only care about status + timing
  scenarios: {
    page: {
      executor: 'ramping-vus',
      exec: 'pageLoad',
      startVUs: 0,
      stages: [
        { duration: '20s', target: Math.ceil(PAGE_VUS * 0.1) },
        { duration: RAMP,  target: PAGE_VUS },
        { duration: HOLD,  target: PAGE_VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    // Only meaningful with a TOKEN; harmless (light) without one.
    credits: {
      executor: 'ramping-vus',
      exec: 'apiCredits',
      startVUs: 0,
      startTime: '15s', // stagger so the two scenarios don't spike in lockstep
      stages: [
        { duration: '20s', target: Math.ceil(API_VUS * 0.1) },
        { duration: RAMP,  target: API_VUS },
        { duration: HOLD,  target: API_VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // The app tier (edge) should stay fast even at peak.
    'http_req_duration{scenario:page}':    ['p(95)<1000', 'p(99)<2500'],
    'page_fail':                           ['rate<0.01'],
    // The DB/auth path is the one to watch — where does p95 blow past ~1.5s and
    // where do errors/backpressure appear?
    'http_req_duration{scenario:credits}': ['p(95)<1500'],
    'api_fail':                            ['rate<0.02'],
    'api_429':                             ['rate<0.05'],
  },
};

export function pageLoad() {
  // Mimic a real first load: HTML + the two big assets. All edge-served.
  const html = http.get(`${BASE}/`, { tags: { name: 'page' } });
  pageFail.add(!check(html, { 'page 200': (r) => r.status === 200 }));
  http.batch([
    ['GET', `${BASE}/chat.js`,    null, { tags: { name: 'asset' } }],
    ['GET', `${BASE}/styles.css`, null, { tags: { name: 'asset' } }],
    ['GET', `${BASE}/studio.js`,  null, { tags: { name: 'asset' } }],
  ]);
  sleep(Math.random() * 2 + 1); // think-time so VUs model real users, not a tight loop
}

export function apiCredits() {
  if (!TOKEN) { sleep(5); return; } // no token → don't touch the authed path
  const res = http.get(`${BASE}/api/credits`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    tags: { name: 'credits' },
  });
  apiLat.add(res.timings.duration);
  const ok = res.status === 200;
  apiFail.add(!ok);
  api429.add(res.status === 429 || res.status === 503);
  check(res, {
    'credits 200':        (r) => r.status === 200,
    'not rate-limited':   (r) => r.status !== 429 && r.status !== 503,
    'auth accepted':      (r) => r.status !== 401,
  });
  sleep(Math.random() * 2 + 1);
}

// Compact end-of-run summary highlighting the numbers that answer the question.
export function handleSummary(data) {
  const m = data.metrics;
  const g = (name, stat) => (m[name] && m[name].values && m[name].values[stat] != null)
    ? Math.round(m[name].values[stat]) : 'n/a';
  const pct = (name) => (m[name] && m[name].values && m[name].values.rate != null)
    ? (m[name].values.rate * 100).toFixed(2) + '%' : 'n/a';
  const line = (l) => l + '\n';
  let s = '\n──────── Go Farther load test ────────\n';
  s += line(`peak VUs      page=${PAGE_VUS}  credits=${TOKEN ? API_VUS : 'off (no token)'}`);
  s += line(`page   p95 / p99   ${g('http_req_duration', 'p(95)')} / ${g('http_req_duration', 'p(99)')} ms`);
  s += line(`credits p95        ${g('api_latency_ms', 'p(95)')} ms   (max ${g('api_latency_ms', 'max')} ms)`);
  s += line(`page failures      ${pct('page_fail')}`);
  s += line(`api  failures      ${pct('api_fail')}`);
  s += line(`api  429/503       ${pct('api_429')}   ← DB/auth backpressure`);
  s += line(`total requests     ${g('http_reqs', 'count')}`);
  s += '─────────────────────────────────\n';
  s += 'Read it like this: if page p95 stays low but credits p95 climbs and\n';
  s += '429/503 appears as you raise API_VUS, that is Supabase (60-connection\n';
  s += 'tier) hitting its ceiling — a scale-up, not a code fix.\n';
  return { stdout: s };
}
