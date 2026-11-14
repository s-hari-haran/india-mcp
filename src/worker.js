// Hosted india-mcp connector (Cloudflare Pages, pages/_worker.js). Streamable HTTP MCP endpoint at /mcp (stateless, JSON responses),
// plus a landing page (/) and privacy notice (/privacy).
import { handleBody, NAME, VERSION } from './server.js';
import { makeApi, DEFAULT_API, WEBSITE, BULK } from './tools.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

// End users are rate-limited one by one: forward a salted hash of their address, never the address itself.
async function clientTag(request, salt) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/mcp' || url.pathname === '/mcp/' || url.pathname === '/sse') {
      if (request.method === 'GET') return new Response('This MCP server answers POST requests (stateless; no event stream).', { status: 405, headers: { Allow: 'POST', ...CORS } });
      if (request.method === 'DELETE') return new Response(null, { status: 204, headers: CORS });
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });
      let body;
      try { body = await request.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
      const key = env.MCP_FEED_KEY || '';
      const api = makeApi({
        base: env.API_BASE || DEFAULT_API,
        headers: key ? { 'x-mcp-key': key, 'x-client-ip': await clientTag(request, key) } : {},
      });
      const out = await handleBody(body, api);
      if (!out) return new Response(null, { status: 202, headers: CORS });
      return json(out);
    }

    if (url.pathname === '/privacy') return html(PRIVACY);
    if (url.pathname === '/health') return json({ ok: true, name: NAME, version: VERSION });
    if (url.pathname === '/' || url.pathname === '') return html(landing(url.origin));
    return new Response('Not found', { status: 404 });
  },
};

const html = (body) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });

const STYLE = `<style>
:root{--bg:#fbfaf7;--fg:#1d1d1f;--muted:#5f6368;--card:#fff;--line:#e3e0d8;--accent:#0b6e4f;--code:#f1efe9}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--muted:#a0a0a0;--card:#1d1d1d;--line:#333;--accent:#4fc59a;--code:#262626}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 64px}h1{font-size:34px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:36px 0 8px}
p{margin:8px 0}.lead{color:var(--muted);font-size:18px}a{color:var(--accent)}
code,pre{font:14px/1.5 ui-monospace,Consolas,monospace;background:var(--code);border-radius:6px}code{padding:2px 6px}
pre{padding:12px 14px;overflow-x:auto;border:1px solid var(--line)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:12px 0}
.url{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.url code{font-size:15px;padding:8px 10px;word-break:break-all}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:8px;padding:6px 12px;cursor:pointer}
ol{padding-left:20px}li{margin:4px 0}footer{margin-top:48px;color:var(--muted);font-size:14px}
</style>`;

function landing(origin) {
  const mcp = `${origin}/mcp`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>India Tenders MCP</title><meta name="description" content="Search every open Indian government tender from Claude, ChatGPT, Cursor and other AI apps. Free MCP connector.">${STYLE}</head>
<body><main>
<h1>India Tenders MCP</h1>
<p class="lead">Ask your AI about open Indian government tenders: about 50,000 at any time from CPPP, GeM, defence, 27+ state portals, PSUs and large companies, refreshed every morning. Free.</p>
<div class="card"><p><b>Connector URL</b></p><div class="url"><code id="u">${mcp}</code><button onclick="navigator.clipboard.writeText(document.getElementById('u').textContent);this.textContent='Copied'">Copy</button></div></div>

<h2>Claude (claude.ai and the Claude apps)</h2>
<ol><li>Open <b>Settings → Connectors</b>.</li><li>Click <b>Add custom connector</b>.</li><li>Name it <code>India Tenders</code>, paste the URL above, click <b>Add</b>.</li><li>In a chat, ask: <i>"Find solar tenders in Gujarat over ₹5 crore closing this month."</i></li></ol>

<h2>ChatGPT</h2>
<ol><li>Open <b>Settings → Apps &amp; Connectors → Advanced settings</b> and turn on <b>Developer mode</b>.</li><li>Back in <b>Apps &amp; Connectors</b>, click <b>Create</b>.</li><li>Name it <code>India Tenders</code>, paste the URL above, choose <b>No authentication</b>, tick the confirmation and click <b>Create</b>.</li><li>In a new chat, pick it from the <b>+ → More</b> menu and ask your question.</li></ol>

<h2>Claude Code, Cursor, VS Code, Windsurf</h2>
<pre>claude mcp add --transport http india-tenders ${mcp}</pre>
<p>Or in any app that reads an <code>mcpServers</code> config:</p>
<pre>{
  "mcpServers": {
    "india-tenders": { "url": "${mcp}" }
  }
}</pre>
<p>Prefer running it locally? <code>npx -y india-mcp</code> (stdio):</p>
<pre>{ "mcpServers": { "india-tenders": { "command": "npx", "args": ["-y", "india-mcp"] } } }</pre>

<h2>What you can ask</h2>
<ul><li>"Road construction tenders in Karnataka above ₹10 crore, biggest first"</li><li>"New CCTV or AMC tenders from Indian Railways this week"</li><li>"Which states have the most open water-supply tenders?"</li><li>"Summarise this tender and what I need to bid" (with a tender id)</li></ul>

<h2>Free use and bulk data</h2>
<p>Each search returns up to 25 tenders (first 100 matches) and each person can make 100 searches an hour. Every tender links to <a href="${WEBSITE}">TenderDesk</a> for AI briefs, daily alerts and bid tracking. For bulk or scheduled exports use the <a href="${BULK}">India Government Tenders Scraper on Apify</a>.</p>

<footer>Open source: <a href="https://github.com/s-hari-haran/india-mcp">github.com/s-hari-haran/india-mcp</a> · <a href="/privacy">Privacy</a> · Listings come from public government portals; always confirm details on the official portal before bidding.</footer>
</main></body></html>`;
}

const PRIVACY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>India Tenders MCP privacy</title>${STYLE}</head>
<body><main><h1>Privacy</h1>
<p>India Tenders MCP is a read-only connector that searches public tender listings.</p>
<ul>
<li><b>No account, no sign-in.</b> We do not ask for or receive your name, email or chat history.</li>
<li><b>What we receive:</b> only the search parameters your AI app sends to a tool (for example "solar", "Gujarat").</li>
<li><b>Your network address</b> is turned into a one-way salted hash so each person gets their own fair-use limit (100 searches an hour). The address itself is not stored. Rate-limit counters expire within hours.</li>
<li><b>Logs:</b> the hosting provider (Cloudflare) keeps standard short-lived request logs. We do not sell or share data.</li>
<li><b>Tender data</b> comes from public government and company procurement portals.</li>
</ul>
<p>Questions: open an issue at <a href="https://github.com/s-hari-haran/india-mcp/issues">github.com/s-hari-haran/india-mcp</a>.</p>
<p><a href="/">← Back</a></p></main></body></html>`;
